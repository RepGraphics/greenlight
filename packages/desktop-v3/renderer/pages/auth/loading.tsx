import AuthLayout from '../../components/authlayout'

export default function AuthLoadingPage() {
    return <AuthLayout>
        <h2 id="auth-heading">Starting Greenlight</h2>
        <p className="auth-status" role="status"><span className="auth-spinner" aria-hidden="true"/> Preparing sign-in…</p>
    </AuthLayout>
}
