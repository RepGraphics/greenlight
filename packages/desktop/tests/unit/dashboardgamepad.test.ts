import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DashboardGamepad } from '../../renderer/lib/dashboardgamepad'

function pad(pressed: number[] = [], axes = [0, 0], id = 'controller', index = 0) {
    return {
        id, index, axes,
        buttons: Array.from({ length: 16 }, (_, button) => {
            const down = pressed.includes(button)
            return { pressed: down, touched: down, value: Number(down) }
        }),
    }
}

test('dashboard input waits for neutral after mounting or losing focus', () => {
    const navigation = new DashboardGamepad()
    const held = pad([0, 13])
    assert.equal(navigation.sample(held, 0), undefined)
    assert.equal(navigation.sample(held, 500), undefined)
    assert.equal(navigation.sample(pad([13]), 510), undefined)
    navigation.sample(pad(), 520)
    assert.equal(navigation.sample(pad([0]), 530)?.activate, true)

    navigation.reset()
    assert.equal(navigation.sample(held, 540), undefined)
    navigation.sample(pad(), 550)
    assert.equal(navigation.sample(pad([13]), 560)?.direction, 'down')
})

test('dashboard input repeats directions and fires face buttons on new presses', () => {
    const navigation = new DashboardGamepad()
    navigation.sample(pad(), 0)
    const right = pad([0], [.8, 0])
    assert.deepEqual(navigation.sample(right, 10), { direction: 'right', activate: true, back: false, previous: false })
    assert.equal(navigation.sample(right, 359), undefined)
    assert.deepEqual(navigation.sample(right, 360), { direction: 'right', activate: false, back: false, previous: false })
    assert.equal(navigation.sample(right, 499), undefined)
    assert.equal(navigation.sample(right, 500)?.direction, 'right')
    assert.deepEqual(navigation.sample(pad([1, 2, 12]), 501), { direction: 'up', activate: false, back: true, previous: true })
    assert.equal(navigation.sample(pad([1, 2, 12]), 502), undefined)
    navigation.sample(pad(), 503)
    assert.equal(navigation.sample(pad([0]), 504)?.activate, true)
})

test('dashboard input rearms after disconnecting or switching controllers', () => {
    const navigation = new DashboardGamepad()
    navigation.sample(pad(), 0)
    assert.equal(navigation.sample(pad([0], [0, 0], 'replacement'), 10), undefined)
    navigation.sample(pad([], [0, 0], 'replacement'), 20)
    assert.equal(navigation.sample(pad([1], [0, 0], 'replacement'), 30)?.back, true)
    navigation.sample(undefined, 40)
    assert.equal(navigation.sample(pad([13], [0, 0], 'replacement'), 50), undefined)
    navigation.sample(pad([], [0, 0], 'replacement'), 60)
    assert.equal(navigation.sample(pad([2], [0, 0], 'replacement', 1), 70), undefined)
})
