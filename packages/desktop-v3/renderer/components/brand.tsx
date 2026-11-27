export default function Brand({showVersion = true}: {showVersion?: boolean}) {
    return <div className="v3-brand">
        <img src="/images/logo.png" alt="" width={48} height={48}/>
        <div>
            <span className="v3-brand-name">Greenlight</span>
            {showVersion&&<span className="v3-brand-version">V3 preview</span>}
        </div>
    </div>
}
