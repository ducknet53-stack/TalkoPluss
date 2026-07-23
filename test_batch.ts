import fetch from 'node-fetch';
async function run() {
  const res = await fetch('http://localhost:3000/api/admin/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [] })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
