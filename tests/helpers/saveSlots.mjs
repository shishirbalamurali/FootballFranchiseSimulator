import assert from 'node:assert/strict';
export async function checkSaveSlots(server) {
    const storage=globalThis.localStorage;
    const initialChoice=storage.getItem('gridiron_active_slot');
    storage.setItem('gridiron_active_slot','0');
    const {useGameStore:store,setActiveSlot}=await server.ssrLoadModule('/src/store/gameStore.js?slot-regression');
    const other=JSON.stringify({initialized:true,userTeamId:'sentinel',year:2099});
    const waitForSave=()=>new Promise(resolve=>setTimeout(resolve,350));
    try {
        storage.setItem('gridiron_save_slot_1',other);
        store.setState({initialized:true,year:2042});
        // Another tab selects slot 1 before this tab's debounce fires.
        storage.setItem('gridiron_active_slot','1');
        await waitForSave();
        assert.ok(storage.getItem('gridiron_save_slot_1')===other,'background save overwrote another slot');
        assert.equal(JSON.parse(storage.getItem('gridiron_save_slot_0')).year,2042);
        store.setState({year:2043});
        setActiveSlot(2); // same-tab picker must flush old pending work first
        store.setState({initialized:false});
        await waitForSave();
        assert.equal(JSON.parse(storage.getItem('gridiron_save_slot_0')).year,2043);
        assert.equal(storage.getItem('gridiron_save_slot_2'),null,'picker alone must not save old franchise into new slot');
        store.getState().selectTeam('bears');
        await waitForSave();
        assert.equal(JSON.parse(storage.getItem('gridiron_save_slot_2')).userTeamId,'bears');
        assert.equal(JSON.parse(storage.getItem('gridiron_save_slot_0')).year,2043);
        assert.ok(storage.getItem('gridiron_save_slot_1')===other);
        console.log('PASS: cross-tab slot isolation, pending-save picker switch, new franchise slot handoff');
    } finally {
        store.setState({initialized:false});
        storage.removeItem('gridiron_save_slot_1');storage.removeItem('gridiron_save_slot_2');
        if(initialChoice===null)storage.removeItem('gridiron_active_slot');else storage.setItem('gridiron_active_slot',initialChoice);
    }
}
