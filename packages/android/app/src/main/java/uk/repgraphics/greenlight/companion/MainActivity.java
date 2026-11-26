package uk.repgraphics.greenlight.companion;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.net.http.SslError;
import android.text.InputType;
import android.view.View;
import android.view.WindowInsets;
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
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.RadioButton;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private LinearLayout root;
    private WebView browser;
    private TextView status;
    private EditText endpoint, password;
    private OriginPolicy origin;
    private ConnectionMode mode = ConnectionMode.DESKTOP_COMPANION;
    private String token;
    private boolean challenged;
    private String lastEndpoint = "";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        showConnect("Choose a connection mode and your trusted private HTTPS endpoint.");
    }

    private void layout() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(16, 24, 39));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        root.requestApplyInsets();
    }

    private TextView text(String value, int size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.WHITE);
        view.setPadding(20, 12, 20, 12);
        return view;
    }

    private void showConnect(String message) {
        layout();
        root.addView(text("Greenlight Android (experimental)", 23));
        RadioGroup modes = new RadioGroup(this);
        RadioButton desktop = new RadioButton(this);
        desktop.setId(View.generateViewId());
        desktop.setText("Desktop companion");
        RadioButton privateV3 = new RadioButton(this);
        privateV3.setId(View.generateViewId());
        privateV3.setText("Private V3 backend (no desktop required)");
        modes.addView(desktop);
        modes.addView(privateV3);
        root.addView(modes);
        modes.check(mode == ConnectionMode.PRIVATE_V3 ? privateV3.getId() : desktop.getId());
        TextView modeHint = text("", 14);
        root.addView(modeHint);
        endpoint = new EditText(this);
        endpoint.setSingleLine(true);
        endpoint.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        endpoint.setHint("https://your-private-host");
        endpoint.setText(lastEndpoint);
        endpoint.setSaveEnabled(false);
        root.addView(endpoint);
        password = new EditText(this);
        password.setSingleLine(true);
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setHint("Desktop WebUI access token");
        password.setSaveEnabled(false);
        root.addView(password);
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
        Button connect = new Button(this);
        connect.setText("Connect");
        root.addView(connect);
        status = text(message, 14);
        root.addView(status);
        connect.setOnClickListener(view -> {
            OriginPolicy selected = OriginPolicy.parse(endpoint.getText().toString().trim());
            String credential = password.getText().toString();
            if (selected == null || !mode.acceptsCredential(credential)) {
                status.setText(mode == ConnectionMode.PRIVATE_V3
                    ? "Enter a trusted private HTTPS V3 origin on port 443."
                    : "Enter an HTTPS origin on port 443 and the 64-character desktop WebUI token.");
                return;
            }
            password.setText("");
            lastEndpoint = selected.home();
            origin = selected;
            token = mode == ConnectionMode.DESKTOP_COMPANION ? credential : null;
            challenged = false;
            openClient();
        });
    }

    private void openClient() {
        layout();
        Button leave = new Button(this);
        leave.setText("Disconnect");
        leave.setOnClickListener(view -> confirmDisconnect());
        root.addView(leave);
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
            root.addView(signIn);
        }
        status = text("Connecting to " + selectedOrigin.home(), 13);
        root.addView(status);
        WebView web = new WebView(this);
        browser = web;
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
                    if (view == browser) status.setText(selectedMode == ConnectionMode.PRIVATE_V3
                        ? "Unexpected HTTP authentication challenge. Check the private V3 access configuration."
                        : "Authentication failed. Disconnect and check the endpoint and token.");
                    return;
                }
                challenged = true;
                handler.proceed("greenlight", token);
                token = null;
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                if (view == browser) status.setText("TLS certificate rejected. Use a trusted HTTPS certificate.");
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (view != browser) return;
                if (!selectedOrigin.allows(url)) {
                    view.stopLoading();
                    status.setText("Blocked navigation outside the selected endpoint.");
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (view == browser && selectedOrigin.allows(url) && status.getText().toString().startsWith("Connecting")) {
                    status.setText(selectedMode == ConnectionMode.PRIVATE_V3
                        ? "Start sign-in in the web client, then use the Microsoft device sign-in button."
                        : "Private companion · End the stream before disconnecting");
                }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == browser) disconnect("WebView stopped. Check for an existing Xbox session before reconnecting.");
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        web.setDownloadListener((url, userAgent, disposition, mime, length) ->
            status.setText("File downloads are not supported in this companion build."));
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        web.loadUrl(selectedMode.landingPage(selectedOrigin));
    }

    private void confirmDisconnect() {
        new AlertDialog.Builder(this).setTitle("Disconnect?")
            .setMessage("End your Xbox stream in the client first. Closing this app cannot confirm remote session termination.")
            .setNegativeButton("Stay", null)
            .setPositiveButton("Disconnect", (dialog, which) -> disconnect("Disconnected."))
            .show();
    }

    private void clearClient() {
        WebView web = browser;
        browser = null;
        origin = null;
        token = null;
        challenged = false;
        if (web != null) {
            root.removeView(web);
            web.stopLoading();
            web.clearHistory();
            web.clearCache(true);
            web.destroy();
        }
        WebViewDatabase.getInstance(this).clearHttpAuthUsernamePassword();
        WebStorage.getInstance().deleteAllData();
        CookieManager.getInstance().removeAllCookies(null);
        CookieManager.getInstance().flush();
    }

    private void disconnect(String message) {
        clearClient();
        showConnect(message);
    }

    @Override public void onBackPressed() {
        if (browser != null) confirmDisconnect();
        else super.onBackPressed();
    }
    @Override protected void onPause() {
        if (browser != null) browser.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (browser != null) browser.onResume();
    }
    @Override protected void onDestroy() {
        clearClient();
        super.onDestroy();
    }
}
