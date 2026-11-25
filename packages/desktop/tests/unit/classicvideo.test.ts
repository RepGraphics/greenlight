import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classicVideoPresentation,neutralFilters,videoPresets,videoFilterCss} from '../../renderer/lib/videofilters'

test('Classic shares validated filter values and presets with V3',()=>{
    for(const preset of Object.values(videoPresets)){
        assert.equal(classicVideoPresentation(preset,'default').filter,videoFilterCss(preset))
    }
    assert.equal(classicVideoPresentation(neutralFilters,'default').filter,'brightness(100%) contrast(100%) saturate(100%)')
})
test('Classic display modes map to scoped holder classes',()=>{
    for(const mode of ['default','stretch','zoom']){
        assert.deepEqual(classicVideoPresentation(null,mode),{mode,className:'gl-classic-display-'+mode,filter:videoFilterCss(null)})
    }
    assert.equal(classicVideoPresentation(null,'unknown').mode,'default')
})
test('Classic presentation rejects unsupported values and bounds filter inputs',()=>{
    const presentation=classicVideoPresentation({brightness:500,contrast:0,saturation:NaN,sharpening:200},'zoom')
    assert.equal(presentation.filter,'brightness(150%) contrast(50%) saturate(100%) url(#gl-stream-sharpen)')
    assert.equal(classicVideoPresentation({brightness:'url(evil)'},'invalid mode').className,'gl-classic-display-default')
})
