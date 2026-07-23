import fs from 'fs';
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

const batchStart = content.indexOf('const adminBatch = async (writes: any[]) => {');
const batchEnd = content.indexOf('  };', batchStart) + 4; // Including the closing brace

const newAdminBatch = `  const adminBatch = async (writes: any[]) => {
    await ensureAdminDoc();
    try {
      const batch = writeBatch(db);
      for (const w of writes) {
        const ref = doc(db, w.path);
        const data = { ...w.data };
        for (const k in data) {
          if (data[k] === '__serverTimestamp') {
            data[k] = serverTimestamp();
          } else if (data[k] && typeof data[k] === 'object' && data[k].__increment !== undefined) {
            data[k] = increment(data[k].__increment);
          }
        }
        if (w.type === 'set') batch.set(ref, data, { merge: w.merge });
        else if (w.type === 'update') batch.update(ref, data);
        else if (w.type === 'delete') batch.delete(ref);
      }
      await batch.commit();
    } catch (err: any) {
      console.warn("Batch commit failed, attempting individual retries:", err);
      // Fallback to individual doc updates
      for (const w of writes) {
        const ref = doc(db, w.path);
        const data = { ...w.data };
        for (const k in data) {
          if (data[k] === '__serverTimestamp') {
            data[k] = serverTimestamp();
          } else if (data[k] && typeof data[k] === 'object' && data[k].__increment !== undefined) {
            data[k] = increment(data[k].__increment);
          }
        }
        if (w.type === 'update') await updateDoc(ref, data);
        else if (w.type === 'delete') await deleteDoc(ref);
        else await setDoc(ref, data, { merge: w.merge });
      }
    }
  };`;

content = content.substring(0, batchStart) + newAdminBatch + content.substring(batchEnd);
fs.writeFileSync('src/components/AdminPanel.tsx', content);
console.log('Fixed syntax in AdminPanel');
