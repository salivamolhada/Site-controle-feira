/**
 * FeiraFinance — Firebase Integration Layer
 * Firebase Authentication & Cloud Firestore Real-time Database
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
  updateDoc,
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
   AUTENTICAÇÃO (GOOGLE, E-MAIL/SENHA, GUEST, LOGOUT) & ADM
   ======================================================== */

export const ADMIN_BOOTSTRAP_EMAIL = 'maioneseraimundo@gmail.com';

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false
    }
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  return errInfo;
}

export function getCurrentAuthActor() {
  const user = auth.currentUser;
  if (!user) return null;
  const fallbackName = user.isAnonymous
    ? 'Convidado Demo'
    : (user.email ? user.email.split('@')[0] : 'Operador');
  return {
    uid: user.uid,
    name: (user.displayName || fallbackName).trim(),
    email: (user.email || '').trim(),
    isAnonymous: Boolean(user.isAnonymous)
  };
}

export function isUserAdmin(user, profile = null) {
  if (!user || user.isAnonymous) return false;
  const emailMatch = Boolean(
    user.email && user.email.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()
  );
  if (emailMatch) return true;
  return Boolean(profile && profile.role === 'admin');
}

function mapRoleToEnum(roleTitle = '', email = '') {
  if (email && String(email).toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
    return 'admin';
  }
  const lower = String(roleTitle).toLowerCase();
  if (lower.includes('coordenador') || lower.includes('gestor') || lower.includes('tesour') || lower.includes('admin')) {
    return 'manager';
  }
  return 'staff';
}

export async function saveUserProfile(user, displayName, roleTitle = 'Coordenador Financeiro') {
  if (!user || user.isAnonymous) return null;
  const docRef = doc(db, 'users', user.uid);
  const cleanName = displayName
    ? displayName.trim()
    : (user.displayName || (user.email ? user.email.split('@')[0] : 'Operador'));
  const nowIso = new Date().toISOString();
  const isBootstrap = Boolean(
    user.email && user.email.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()
  );

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() || {};
      const preservedRole = isBootstrap ? 'admin' : (existing.role || mapRoleToEnum(roleTitle, user.email));
      const payload = {
        uid: user.uid,
        email: user.email || existing.email || '',
        displayName: cleanName || existing.displayName || 'Operador',
        role: preservedRole,
        roleTitle: existing.roleTitle || (isBootstrap ? 'Administrador Geral' : (roleTitle || 'Coordenador Financeiro')),
        updatedAt: nowIso
      };
      await setDoc(docRef, payload, { merge: true });
      return { ...existing, ...payload };
    } else {
      const assignedRole = mapRoleToEnum(roleTitle, user.email);
      const assignedTitle = isBootstrap ? 'Administrador Geral' : (roleTitle || 'Coordenador Financeiro');
      const payload = {
        uid: user.uid,
        email: user.email || '',
        displayName: cleanName,
        role: assignedRole,
        roleTitle: assignedTitle,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await setDoc(docRef, payload, { merge: true });
      return payload;
    }
  } catch (dbErr) {
    console.warn('[Firebase] Perfil de usuário salvo localmente:', dbErr);
    return null;
  }
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[Firestore] Erro ao buscar perfil do usuário:', err);
    return null;
  }
}

/**
 * Login / Criação de conta com Google (Popup)
 */
export async function loginWithGoogle(roleTitle = 'Coordenador Financeiro') {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    await saveUserProfile(cred.user, cred.user.displayName, roleTitle);
    return { success: true, user: cred.user };
  } catch (error) {
    const code = error?.code || error?.message || 'unknown';
    return { success: false, code, error: translateAuthError(code, 'google') };
  }
}

/**
 * Login com e-mail e senha
 */
export async function loginUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await saveUserProfile(cred.user, cred.user.displayName);
    return { success: true, user: cred.user };
  } catch (error) {
    const code = error?.code || error?.message || 'unknown';
    return { success: false, code, error: translateAuthError(code, 'login') };
  }
}

/**
 * Cadastro de nova conta com e-mail e senha
 */
export async function registerUser(email, password, displayName, roleTitle = 'Coordenador Financeiro') {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    await saveUserProfile(cred.user, displayName, roleTitle);
    return { success: true, user: cred.user };
  } catch (error) {
    const code = error?.code || error?.message || 'unknown';
    return { success: false, code, error: translateAuthError(code, 'register') };
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
    const code = error?.code || error?.message || 'unknown';
    const isProviderDisabled =
      code === 'auth/admin-restricted-operation' ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found';
    return {
      success: false,
      code,
      fallbackLocalDemo: isProviderDisabled,
      error: translateAuthError(code, 'guest')
    };
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
function translateAuthError(code, context = 'auth') {
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
    case 'auth/password-does-not-meet-requirements':
      return 'A senha não atende aos requisitos mínimos de segurança (letras, números e 6+ caracteres).';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      if (context === 'guest') {
        return 'O login anônimo ainda não está ativado no Firebase Console.';
      }
      return 'O provedor E-mail/Senha ainda não está ativado no Firebase Console deste projeto. Use o botão "Continuar com Google" acima ou ative E-mail/senha em Authentication > Sign-in method.';
    case 'auth/admin-restricted-operation':
      return 'Este método está restrito nas configurações do Firebase Auth. Use "Continuar com Google" acima para criar sua conta instantaneamente.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'A janela de login com o Google foi fechada antes de concluir.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou o pop-up do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/unauthorized-domain':
      return 'Este domínio precisa ser autorizado em Firebase Console > Authentication > Settings > Authorized domains.';
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

/**
 * Observa em tempo real a coleção de usuários cadastrados (somente ADM)
 */
export function subscribeUsers(onUpdate, onError) {
  const colRef = collection(db, 'users');
  return onSnapshot(colRef, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(list);
  }, (err) => {
    handleFirestoreError(err, 'list', 'users');
    if (onError) onError(err);
  });
}

/**
 * Atualiza função/permissão de um usuário cadastrado (somente ADM)
 */
export async function updateUserRole(targetUid, newRole, newRoleTitle) {
  try {
    const docRef = doc(db, 'users', targetUid);
    await updateDoc(docRef, {
      role: newRole,
      roleTitle: newRoleTitle,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (err) {
    const info = handleFirestoreError(err, 'update', `users/${targetUid}`);
    return { success: false, error: info.error };
  }
}

/* ========================================================
   OPERAÇÕES DE ESCRITA NO CLOUD FIRESTORE
   ======================================================== */

export async function saveTransactionToFirestore(tx) {
  try {
    const cleanId = String(tx.id || `tx_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, 'transactions', cleanId);
    const actor = getCurrentAuthActor();
    await setDoc(docRef, {
      ...tx,
      id: cleanId,
      uid: tx.uid || (actor ? actor.uid : 'anonymous'),
      createdByUid: tx.createdByUid || (actor ? actor.uid : ''),
      createdByName: tx.createdByName || (actor ? actor.name : ''),
      createdByEmail: tx.createdByEmail || (actor ? actor.email : ''),
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
