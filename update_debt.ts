import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function update() {
  const debtsSnap = await getDocs(collection(db, 'debts'));
  for (const d of debtsSnap.docs) {
    if (d.data().userId === 'yXJvO1s5nugr5h3wZ5Gz7W0QYvJ2') { // well wait, let's just update all debts for now or check email.
       await updateDoc(doc(db, 'debts', d.id), { totalAmount: 10500 });
       console.log('Updated debt:', d.id);
    }
  }
}
update().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
