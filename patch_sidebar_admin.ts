import fs from 'fs';
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

const insertPos = content.indexOf('<div className="p-4 border-b border-gray-100');
const forceAdminBtn = `
      {currentUser?.email === 'gogeta.blue053wow@gmail.com' && !userProfile?.isAdmin && (
        <button
          onClick={async () => {
            try {
              const { doc, updateDoc } = await import('firebase/firestore');
              const { db } = await import('../lib/firebase');
              await updateDoc(doc(db, 'users', currentUser.uid), { isAdmin: true });
              alert('Başarıyla admin oldunuz! Lütfen sayfayı yenileyin.');
            } catch (err: any) {
              alert('Admin olma hatası: ' + err.message);
            }
          }}
          className="w-full bg-red-500 text-white p-2 font-bold text-xs"
        >
          ZORLA ADMİN OL (SADECE GOGETA)
        </button>
      )}
`;

content = content.substring(0, insertPos) + forceAdminBtn + content.substring(insertPos);
fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('Patched Sidebar');
