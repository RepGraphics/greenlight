import {test} from 'node:test'
import assert from 'node:assert/strict'
import {appearanceThemes,appearanceAccents,normalizeAppearance} from '../../renderer/lib/appearance'
import {portableSettings} from '../../renderer/lib/settingsbackup'
test('appearance accepts all known theme/accent combinations',()=>{
    for(const theme of appearanceThemes)for(const accent of appearanceAccents)assert.deepEqual(normalizeAppearance(theme,accent),{theme,accent})
})
test('invalid stored values cannot inject CSS or attributes',()=>{
    assert.deepEqual(normalizeAppearance('url(evil)','<script>'),{theme:'graphite',accent:'green'})
    assert.deepEqual(normalizeAppearance(null,'violet'),{theme:'graphite',accent:'violet'})
})
test('portable appearance settings reject unsupported values',()=>{
    assert.deepEqual(portableSettings({appearance_theme:'oled',appearance_accent:'amber'}),{appearance_theme:'oled',appearance_accent:'amber'})
    assert.deepEqual(portableSettings({appearance_theme:'__proto__',appearance_accent:42}),{})
})
