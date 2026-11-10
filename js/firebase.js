/**
 * FeiraFinance — Firebase Integration Layer
 * Firebase Authentication & Cloud Firestore Real-time Database
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  deleteDoc,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';

// Carrega as configurações do Firebase geradas pelo provisionamento
import firebaseConfig from '../firebase-applet-config.json';

// Inicializa a aplicação Firebase
export const app = initializeApp(firebaseConfig);

// Inicializa o Firebase Authentication
export const auth = getAuth(app);

// Inicializa o Cloud Firestore com o banco provisionado
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Validação de conectividade obrigatória (Skill directive)
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Conexão com Firestore verificada com sucesso.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Cliente em modo offline ou sem conexão imediata.');
    } else {
      console.log('[Firebase] Teste de conectividade concluído.');
    }
    return false;
  }
}

// Executa validação de conexão na inicialização
testConnection().catch(() => {});

/* ========================================================
   AUTENTICAÇÃO (LOGIN, REGISTRO, GUEST, LOGOUT)
   ======================================================== */

/**
 * Login com e-mail e senha
 */
export async function loginUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { success: true, user: cred.user };
  } catch (error) {
    return { success: false, error: translateAuthError(error.code || error.message) };
  }
}

/**
 * Cadastro de nova conta
 */
export async function registerUser(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }

    // Salva perfil inicial no Firestore
    try {
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName ? displayName.trim() : cred.user.email.split('@')[0],
        role: 'manager',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (dbErr) {
      console.warn('[Firebase] Perfil de usuário em modo local:', dbErr);
    }

    return { success: true, user: cred.user };
  } catch (error) {
    return { success: false, error: translateAuthError(error.code || error.message) };
  }
}

/**
 * Acesso rápido como convidado / demonstração
 */
export async function loginAsGuest() {
  try {
    const cred = await signInAnonymously(auth);
    return { success: true, user: cred.user };
  } catch (error) {
    return { success: false, error: translateAuthError(error.code || error.message) };
  }
}

/**
 * Logout
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Observador de estado de autenticação
 */
export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Tradutor de mensagens de erro do Firebase Auth para Português
 */
function translateAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'O formato do e-mail inserido é inválido.';
    case 'auth/user-disabled':
      return 'Esta conta de usuário foi temporariamente desativada.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado. Verifique seu e-mail ou crie uma conta.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos. Tente novamente.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso por outro usuário cadastrado.';
    case 'auth/weak-password':
      return 'A senha deve conter no mínimo 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'Operação de autenticação não habilitada no momento.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Aguarde alguns instantes.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com a rede. Verifique sua internet.';
    default:
      return 'Erro na autenticação: ' + code;
  }
}

/* ========================================================
   SINCRONIZAÇÃO EM TEMPO REAL COM O CLOUD FIRESTORE
   ======================================================== */

/**
 * Observa em tempo real a coleção de transações
 */
export function subscribeTransactions(onUpdate, onError) {
  const colRef = collection(db, 'transactions');
  return onSnapshot(colRef, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(list);
  }, (err) => {
    console.warn('[Firestore] Transações offline/local:', err);
    if (onError) onError(err);
  });
}

/**
 * Observa em tempo real a coleção de estandes
 */
export function subscribeBooths(onUpdate, onError) {
  const colRef = collection(db, 'booths');
  return onSnapshot(colRef, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(list);
  }, (err) => {
    console.warn('[Firestore] Estandes offline/local:', err);
    if (onError) onError(err);
  });
}

/**
 * Observa em tempo real o documento de configurações da feira
 */
export function subscribeSettings(onUpdate, onError) {
  const docRef = doc(db, 'settings', 'fair_config');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    }
  }, (err) => {
    console.warn('[Firestore] Configurações offline/local:', err);
    if (onError) onError(err);
  });
}

/* ========================================================
   OPERAÇÕES DE ESCRITA NO CLOUD FIRESTORE
   ======================================================== */

export async function saveTransactionToFirestore(tx) {
  try {
    const cleanId = String(tx.id || `tx_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, 'transactions', cleanId);
    await setDoc(docRef, {
      ...tx,
      id: cleanId,
      uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao salvar transação na nuvem:', e);
    return false;
  }
}

export async function deleteTransactionFromFirestore(txId) {
  try {
    const cleanId = String(txId).replace(/[^a-zA-Z0-9_-]/g, '_');
    await deleteDoc(doc(db, 'transactions', cleanId));
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao excluir transação na nuvem:', e);
    return false;
  }
}

export async function deleteTransactionsBatchFromFirestore(ids) {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.delete(doc(db, 'transactions', cleanId));
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao excluir transações em lote:', e);
    return false;
  }
}

export async function saveBoothToFirestore(booth) {
  try {
    const cleanId = String(booth.id || `bth_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, 'booths', cleanId);
    await setDoc(docRef, {
      ...booth,
      id: cleanId,
      uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao salvar estande na nuvem:', e);
    return false;
  }
}

export async function deleteBoothFromFirestore(boothId) {
  try {
    const cleanId = String(boothId).replace(/[^a-zA-Z0-9_-]/g, '_');
    await deleteDoc(doc(db, 'booths', cleanId));
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao excluir estande na nuvem:', e);
    return false;
  }
}

export async function saveSettingsToFirestore(settings) {
  try {
    const docRef = doc(db, 'settings', 'fair_config');
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao salvar configurações na nuvem:', e);
    return false;
  }
}

/**
 * Seeding de dados iniciais ou restauração de demonstração na nuvem
 */
export async function seedDemoDataToFirestore(txs, booths, settings) {
  try {
    const batch = writeBatch(db);

    // Configurações
    batch.set(doc(db, 'settings', 'fair_config'), {
      ...settings,
      updatedAt: new Date().toISOString()
    });

    // Lançamentos
    txs.forEach(t => {
      const cleanId = String(t.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.set(doc(db, 'transactions', cleanId), {
        ...t,
        id: cleanId,
        uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
        updatedAt: new Date().toISOString()
      });
    });

    // Estandes
    booths.forEach(b => {
      const cleanId = String(b.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.set(doc(db, 'booths', cleanId), {
        ...b,
        id: cleanId,
        uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
        updatedAt: new Date().toISOString()
      });
    });

    await batch.commit();
    console.log('[Firestore] Dados de demonstração sincronizados com a nuvem.');
    return true;
  } catch (e) {
    console.warn('[Firestore] Erro ao semear dados iniciais:', e);
    return false;
  }
}
