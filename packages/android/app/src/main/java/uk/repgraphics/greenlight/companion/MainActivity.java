package uk.repgraphics.greenlight.companion;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.webkit.WebResourceError;
import android.content.SharedPreferences;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.net.http.SslError;
import android.text.InputType;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.HttpAuthHandler;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebViewDatabase;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.HorizontalScrollView;
import android.view.inputmethod.EditorInfo;
import android.widget.RadioGroup;
import android.widget.RadioButton;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private LinearLayout root;
    private WebView browser;
    private LinearLayout clientControls;
    private final PlaybackDisplay display = new PlaybackDisplay();
    private final ConnectionHealth health = new ConnectionHealth();
    private boolean clearingCookies;
    private Button connectButton;
    private int previousSystemUi;
    private TextView status;
    private EditText endpoint, password;
    private OriginPolicy origin;
    private ConnectionMode mode = ConnectionMode.DESKTOP_COMPANION;
    private String token;
    private boolean challenged;
    private boolean resumed;
    private PermissionRequest pendingMicrophone;
    private boolean systemMicrophonePrompt;
    private AlertDialog microphoneDialog;
    private static final int MICROPHONE_PERMISSION = 410;
    private String lastEndpoint = "";
    private boolean rememberEndpoint;
    private SharedPreferences connectionPreferences;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        connectionPreferences = getSharedPreferences("connection", MODE_PRIVATE);
        try {
            SavedConnection saved = SavedConnection.parse(
                connectionPreferences.getString("origin", null),
                connectionPreferences.getString("mode", null));
            if (saved != null) {
                lastEndpoint = saved.origin.home();
                mode = saved.mode;
                rememberEndpoint = true;
            } else connectionPreferences.edit().clear().apply();
        } catch (ClassCastException error) {
            connectionPreferences.edit().clear().apply();
        }
        // Clear session residue before opening a new WebView, including after process death.
        clearSessionStorage();
        showConnect("Choose a connection mode and your trusted private HTTPS endpoint.");
    }

    private void layout() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(16, 24, 39));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(Math.max(bars.left, keyboard.left), Math.max(bars.top, keyboard.top),
                    Math.max(bars.right, keyboard.right), Math.max(bars.bottom, keyboard.bottom));
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        root.requestApplyInsets();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView text(String value, int size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.WHITE);
        view.setPadding(dp(12), dp(6), dp(12), dp(6));
        return view;
    }

    private void showConnect(String message) {
        layout();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(12), dp(8), dp(12), dp(12));
        scroll.addView(form, new ScrollView.LayoutParams(-1, -2));
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        form.addView(text("Greenlight Android (experimental)", 23));
        RadioGroup modes = new RadioGroup(this);
        RadioButton desktop = new RadioButton(this);
        desktop.setId(View.generateViewId());
        desktop.setText("Desktop companion");
        RadioButton privateV3 = new RadioButton(this);
        privateV3.setId(View.generateViewId());
        privateV3.setText("Private V3 backend (no desktop required)");
        modes.addView(desktop);
        modes.addView(privateV3);
        form.addView(modes);
        modes.check(mode == ConnectionMode.PRIVATE_V3 ? privateV3.getId() : desktop.getId());
        TextView modeHint = text("", 14);
        form.addView(modeHint);
        endpoint = new EditText(this);
        endpoint.setSingleLine(true);
        endpoint.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        endpoint.setHint("https://your-private-host");
        endpoint.setText(lastEndpoint);
        endpoint.setSaveEnabled(false);
        endpoint.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        endpoint.setImeOptions(EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING | EditorInfo.IME_ACTION_NEXT);
        form.addView(endpoint);
        password = new EditText(this);
        password.setSingleLine(true);
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setHint("Desktop WebUI access token");
        password.setSaveEnabled(false);
        password.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        password.setImeOptions(EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING | EditorInfo.IME_ACTION_DONE);
        form.addView(password);
        Runnable updateMode = () -> {
            mode = modes.getCheckedRadioButtonId() == privateV3.getId()
                ? ConnectionMode.PRIVATE_V3 : ConnectionMode.DESKTOP_COMPANION;
            password.setText("");
            password.setVisibility(mode == ConnectionMode.PRIVATE_V3 ? View.GONE : View.VISIBLE);
            modeHint.setText(mode == ConnectionMode.PRIVATE_V3
                ? "Experimental · Requires your own access-controlled V3 web backend over a private network or VPN. Sign in with Microsoft in your system browser. Never use an untrusted or public backend."
                : "Requires a signed-in desktop backend. Do not expose WebUI publicly. End any active stream before disconnecting.");
        };
        modes.setOnCheckedChangeListener((group, id) -> updateMode.run());
        updateMode.run();
        CheckBox remember = new CheckBox(this);
        remember.setText("Remember endpoint and connection mode (not credentials)");
        remember.setChecked(rememberEndpoint);
        form.addView(remember);
        remember.setOnCheckedChangeListener((button, checked) -> {
            rememberEndpoint = checked;
            if (!checked) connectionPreferences.edit().clear().apply();
        });
        Button forget = new Button(this);
        forget.setText("Forget saved connection");
        form.addView(forget);
        forget.setOnClickListener(view -> {
            remember.setChecked(false);
            rememberEndpoint = false;
            connectionPreferences.edit().clear().apply();
            lastEndpoint = "";
            endpoint.setText("");
            password.setText("");
            modes.check(desktop.getId());
            status.setText("Saved connection cleared.");
        });
        Button connect = new Button(this);
        connectButton = connect;
        connect.setText("Connect");
        connect.setEnabled(!clearingCookies);
        form.addView(connect);
        Button diagnostics = new Button(this);
        diagnostics.setText("Share connection diagnostics");
        diagnostics.setOnClickListener(view -> shareDiagnostics());
        form.addView(diagnostics);
        status = text(message, 14);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        form.addView(status);
        connect.setOnClickListener(view -> {
            if (clearingCookies || browser != null) return;
            OriginPolicy selected = OriginPolicy.parse(endpoint.getText().toString().trim());
            String credential = password.getText().toString();
            if (selected == null || !mode.acceptsCredential(credential)) {
                status.setText(mode == ConnectionMode.PRIVATE_V3
                    ? "Enter a trusted private HTTPS V3 origin on port 443."
                    : "Enter an HTTPS origin on port 443 and the 64-character desktop WebUI token.");
                status.announceForAccessibility(status.getText());
                scroll.post(() -> scroll.smoothScrollTo(0, status.getBottom()));
                return;
            }
            password.setText("");
            lastEndpoint = selected.home();
            if (rememberEndpoint) {
                connectionPreferences.edit().putString("origin", selected.home())
                    .putString("mode", mode.name()).apply();
            } else connectionPreferences.edit().clear().apply();
            origin = selected;
            token = mode == ConnectionMode.DESKTOP_COMPANION ? credential : null;
            challenged = false;
            health.start(mode);
            connectButton = null;
            openClient();
        });
    }

    private void openClient() {
        layout();
        clientControls = new LinearLayout(this);
        clientControls.setOrientation(LinearLayout.VERTICAL);
        root.addView(clientControls);
        HorizontalScrollView toolbarScroll = new HorizontalScrollView(this);
        toolbarScroll.setFillViewport(true);
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbarScroll.addView(toolbar, new HorizontalScrollView.LayoutParams(-2, -2));
        clientControls.addView(toolbarScroll);
        Button leave = new Button(this);
        leave.setText("Disconnect");
        leave.setOnClickListener(view -> confirmDisconnect());
        toolbar.addView(leave);
        Button fullscreen = new Button(this);
        fullscreen.setText("Fullscreen (Back to exit)");
        fullscreen.setOnClickListener(view -> {
            if (browser != null && display.enter()) {
                previousSystemUi = getWindow().getDecorView().getSystemUiVisibility();
                applyDisplay();
            }
        });
        toolbar.addView(fullscreen);
        Button diagnostics = new Button(this);
        diagnostics.setText("Share diagnostics");
        diagnostics.setOnClickListener(view -> shareDiagnostics());
        toolbar.addView(diagnostics);
        final OriginPolicy selectedOrigin = origin;
        final ConnectionMode selectedMode = mode;
        if (selectedMode == ConnectionMode.PRIVATE_V3) {
            Button signIn = new Button(this);
            signIn.setText("Open Microsoft device sign-in");
            signIn.setOnClickListener(view -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(ConnectionMode.MICROSOFT_DEVICE_LOGIN));
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    startActivity(intent);
                } catch (ActivityNotFoundException error) {
                    status.setText("No browser available. Visit microsoft.com/devicelogin on another device.");
                }
            });
            toolbar.addView(signIn);
        }
        status = text("Connecting to " + selectedOrigin.home(), 13);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        clientControls.addView(status);
        WebView web = new WebView(this);
        browser = web;
        display.connected();
        web.setKeepScreenOn(true);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return view != browser || !selectedOrigin.allows(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Capture the policy of this WebView. A late callback from a
                // disconnected view must not acquire a new endpoint's policy.
                if (selectedOrigin.allows(request.getUrl().toString())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {
                if (view != browser || token == null || challenged || !selectedMode.allowsChallenge(selectedOrigin, host, realm)) {
                    handler.cancel();
                    if (view == browser) {
                        health.fail(ConnectionHealth.State.AUTH);
                        if (display.exit()) applyDisplay();
                        status.setText(selectedMode == ConnectionMode.PRIVATE_V3
                        ? "Unexpected HTTP authentication challenge. Check the private V3 access configuration."
                        : "Authentication failed. Disconnect and check the endpoint and token.");
                    }
                    return;
                }
                challenged = true;
                handler.proceed("greenlight", token);
                token = null;
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                if (view == browser) reportFailure(ConnectionHealth.State.TLS);
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (view != browser) return;
                if (!selectedOrigin.allows(url)) {
                    view.stopLoading();
                    reportFailure(ConnectionHealth.State.NAVIGATION_BLOCKED);
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (view == browser && selectedOrigin.allows(url) && health.state() == ConnectionHealth.State.LOADING) {
                    health.pageLoaded();
                    status.setText(selectedMode == ConnectionMode.PRIVATE_V3
                        ? "Start sign-in in the web client, then use the Microsoft device sign-in button."
                        : "Private companion · End the stream before disconnecting");
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (view == browser && request.isForMainFrame()) reportFailure(ConnectionHealth.networkError(error.getErrorCode()));
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (view == browser && request.isForMainFrame()) reportFailure(ConnectionHealth.httpError(response.getStatusCode()));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == browser) {
                    health.fail(ConnectionHealth.State.RENDERER_STOPPED);
                    clearClient(true);
                    showConnect(health.guidance());
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { requestMicrophone(web, selectedOrigin, selectedMode, request); }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingMicrophone == request) {
                    pendingMicrophone = null;
                    if (microphoneDialog != null) microphoneDialog.dismiss();
                    microphoneDialog = null;
                }
            }
        });
        web.setDownloadListener((url, userAgent, disposition, mime, length) ->
            { if (web == browser) status.setText("File downloads are not supported in this companion build."); });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        web.loadUrl(selectedMode.landingPage(selectedOrigin));
    }

    private boolean microphoneAllowed(WebView web, OriginPolicy selected, ConnectionMode selectedMode, PermissionRequest request) {
        return web == browser && resumed && !isFinishing() && !isDestroyed()
            && MicrophonePolicy.allows(selected, selectedMode, request.getOrigin().toString(), request.getResources(), true)
            && selected.allows(web.getUrl());
    }

    private void denyPendingMicrophone() {
        PermissionRequest request = pendingMicrophone;
        pendingMicrophone = null;
        if (microphoneDialog != null) microphoneDialog.dismiss();
        microphoneDialog = null;
        if (request != null) { try { request.deny(); } catch (RuntimeException ignored) { } }
    }

    private void requestMicrophone(WebView web, OriginPolicy selected, ConnectionMode selectedMode, PermissionRequest request) {
        if (systemMicrophonePrompt || pendingMicrophone != null || !microphoneAllowed(web, selected, selectedMode, request)) {
            request.deny();
            return;
        }
        pendingMicrophone = request;
        microphoneDialog = new AlertDialog.Builder(this)
            .setTitle("Allow voice chat?")
            .setMessage("Allow this private V3 client to use your microphone for voice chat? The selected backend is trusted. Disable the microphone in the stream controls or disconnect to end access.")
            .setNegativeButton("Deny", (dialog, which) -> denyPendingMicrophone())
            .setPositiveButton("Allow", (dialog, which) -> {
                microphoneDialog = null;
                if (pendingMicrophone != request || !microphoneAllowed(web, selected, selectedMode, request)) {
                    denyPendingMicrophone();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    pendingMicrophone = null;
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    systemMicrophonePrompt = true;
                    try { requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_PERMISSION); }
                    catch (RuntimeException error) { systemMicrophonePrompt = false; denyPendingMicrophone(); }
                }
            }).setOnCancelListener(dialog -> denyPendingMicrophone()).create();
        microphoneDialog.show();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != MICROPHONE_PERMISSION) return;
        systemMicrophonePrompt = false;
        // The OS permission prompt can pause the Activity. A paused/cancelled
        // WebView request is never revived; the user may enable voice chat again.
        PermissionRequest request = pendingMicrophone;
        if (request == null) return;
        pendingMicrophone = null;
        if (results.length == 1 && results[0] == PackageManager.PERMISSION_GRANTED &&
            browser != null && microphoneAllowed(browser, origin, mode, request)) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else request.deny();
    }

    private void applyDisplay() {
        boolean immersive = display.isImmersive();
        if (clientControls != null) clientControls.setVisibility(immersive ? View.GONE : View.VISIBLE);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                if (immersive) {
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    controller.hide(WindowInsets.Type.systemBars());
                } else controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(immersive
                ? previousSystemUi | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                : previousSystemUi);
        }
        root.requestApplyInsets();
    }

    private void confirmDisconnect() {
        final WebView selected = browser;
        new AlertDialog.Builder(this).setTitle("Disconnect?")
            .setMessage("End your Xbox stream in the client first. Closing this app cannot confirm remote session termination.")
            .setNegativeButton("Stay", null)
            .setPositiveButton("Disconnect", (dialog, which) -> { if (selected != null && selected == browser) disconnect("Disconnected."); })
            .show();
    }

    private void reportFailure(ConnectionHealth.State failure) {
        health.fail(failure);
        if (display.exit()) applyDisplay();
        status.setText(health.guidance());
    }

    private void shareDiagnostics() {
        String appVersion = null;
        try { appVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (android.content.pm.PackageManager.NameNotFoundException ignored) { }
        PackageInfo webView = WebView.getCurrentWebViewPackage();
        String report = health.report(Build.VERSION.SDK_INT, appVersion, webView == null ? null : webView.versionName, display.isImmersive());
        new AlertDialog.Builder(this).setTitle("Share connection diagnostics?")
            .setMessage(report + "No endpoint, token, account or game identifiers are included.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Share", (dialog, which) -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, report);
                try { startActivity(Intent.createChooser(send, "Share diagnostics")); }
                catch (ActivityNotFoundException error) { status.setText("No sharing app available."); }
            }).show();
    }

    private void clearClient(boolean rendererGone) {
        denyPendingMicrophone();
        WebView web = browser;
        if (display.disconnected()) applyDisplay();
        clientControls = null;
        browser = null;
        origin = null;
        token = null;
        challenged = false;
        if (web != null) {
            root.removeView(web);
            if (!rendererGone) {
                web.stopLoading();
                web.clearHistory();
                web.clearCache(true);
            }
            web.destroy();
        }
        clearSessionStorage();
    }

    private void clearSessionStorage() {
        clearingCookies = true;
        if (connectButton != null) connectButton.setEnabled(false);
        WebViewDatabase.getInstance(this).clearHttpAuthUsernamePassword();
        WebStorage.getInstance().deleteAllData();
        CookieManager.getInstance().removeAllCookies(removed -> {
            CookieManager.getInstance().flush();
            clearingCookies = false;
            if (!isFinishing() && !isDestroyed() && connectButton != null) connectButton.setEnabled(true);
        });
    }

    private void disconnect(String message) {
        health.disconnected();
        clearClient(false);
        showConnect(message);
    }

    @Override public void onBackPressed() {
        if (display.exit()) applyDisplay();
        else if (browser != null) confirmDisconnect();
        else super.onBackPressed();
    }
    @Override protected void onPause() {
        resumed = false;
        denyPendingMicrophone();
        if (browser != null) browser.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        if (browser != null) {
            browser.onResume();
            if (display.isImmersive()) applyDisplay();
        }
    }
    @Override protected void onDestroy() {
        connectButton = null;
        clearClient(false);
        super.onDestroy();
    }
}
