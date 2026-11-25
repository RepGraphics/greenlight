import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classicShortcutAction} from '../../renderer/lib/streamshortcuts'
const event={key:'F8',repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,editable:false}
test('Classic uses shared configurable shortcuts and disabled bindings',()=>{assert.equal(classicShortcutAction({},event,false,{}),'controls');assert.equal(classicShortcutAction({controls:'',screenshot:'F8'},event,false,{}),'screenshot');assert.equal(classicShortcutAction({controls:''},event,false,{}),undefined)})
test('Classic shortcuts preserve game input and native keyboard focus',()=>{assert.equal(classicShortcutAction({},event,true,{}),undefined);assert.equal(classicShortcutAction({},event,false,{F8:'A'}),undefined);assert.equal(classicShortcutAction({},event,false,{},true),undefined);assert.equal(classicShortcutAction({}, {...event,editable:true},false,{}),undefined);assert.equal(classicShortcutAction({}, {...event,repeat:true},false,{}),undefined)})
