import fs from 'fs';
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');
const lines = content.split('\n');
const start = 347; // 0-indexed, so line 348 is index 347
const end = 412; // 0-indexed, so line 412 is index 411

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

lines.splice(start, end - start, newAdminBatch);
fs.writeFileSync('src/components/AdminPanel.tsx', lines.join('\n'));
console.log('Fixed lines');
