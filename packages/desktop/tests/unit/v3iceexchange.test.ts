import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sendICECandidates,sendSDPOffer} from '../../../player/src/server/index'
import {xboxIceAnswer} from '../../../player/src/server/iceexchange'

const config={id:'console',type:'home' as const,resolution:1080 as const,language:'en-GB',host:'https://uks.core.gssv-play-prodxhome.xboxlive.com'}
const token={token:'test',market:'GB',language:'en-GB'}
const path='/v5/sessions/home/session-1'
const local=[{candidate:'candidate:1 1 udp 10 192.0.2.5 5000 typ host',sdpMid:'0',sdpMLineIndex:0}]
const remote=[{candidate:'a=candidate:2 1 UDP 10 192.0.2.6 9002 typ host',sdpMid:'0',sdpMLineIndex:'0'}]

test('Remote Play uses the Xbox ICE request envelope and keeps polling a pending answer',async()=>{
    const original=globalThis.fetch
    const methods:string[]=[]
    try {
        globalThis.fetch=async(url,init)=>{
            assert.equal(url,config.host+path+'/ice')
            methods.push(init?.method??'')
            if(init?.method==='POST'){
                assert.deepEqual(JSON.parse(String(init.body)),{messageType:'iceCandidate',candidate:local})
                return new Response(null,{status:204})
            }
            if(methods.length===2)return Response.json({exchangeResponse:null,errorDetails:{code:null,message:null}})
            return Response.json({exchangeResponse:JSON.stringify(remote)})
        }
        assert.deepEqual(JSON.parse((await sendICECandidates(token,config,path,local)).exchangeResponse),remote)
        assert.deepEqual(methods,['POST','GET','GET'])
    }finally{globalThis.fetch=original}
})

test('console-only Teredo responses gain deduplicated IPv4 routes before the end marker',()=>{
    const teredo={candidate:'a=candidate:3 1 UDP 1 2001:0000:4136:e378:8000:63bf:3fff:fdd2 9002 typ host',sdpMid:'0',sdpMLineIndex:'0'}
    const ordinary={...teredo,candidate:'candidate:4 1 UDP 1 2001:db8::1 9002 typ host'}
    const existing={...teredo,candidate:'candidate:5 1 UDP 1 192.0.2.45 9002 typ host'}
    const end={...teredo,candidate:'a=end-of-candidates'}
    const candidates=[teredo,ordinary,existing,end]
    const expanded=xboxIceAnswer(JSON.stringify(candidates),true)
    assert.deepEqual(expanded.slice(0,3),[teredo,ordinary,existing])
    assert.match(expanded[3].candidate,/192\.0\.2\.45 40000 typ host/)
    assert.deepEqual(expanded[4],end)
    assert.deepEqual(xboxIceAnswer(JSON.stringify(candidates),false),candidates)
    assert.throws(()=>xboxIceAnswer('sensitive invalid response',true),/^Error: Invalid Xbox ICE response$/)
})

test('an explicit signaling rejection is reported without upstream content',async()=>{
    const original=globalThis.fetch
    try {
        globalThis.fetch=async(_url,init)=>init?.method==='POST'?new Response(null,{status:204})
            :Response.json({exchangeResponse:null,errorDetails:{code:42,message:'sensitive upstream error'}})
        await assert.rejects(sendSDPOffer(token,config,path,{type:'offer',sdp:'v=0\r\n'}),/^Error: Xbox rejected the signaling exchange$/)
    }finally{globalThis.fetch=original}
})
