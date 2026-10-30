import { useRef, useState } from 'react';
import { useEtable } from '../store/EtableContext';
import { useToast } from '../store/ToastContext';
import { parseBackup, toBackup } from '../store/storage';
import { ConfirmButton } from './ui';

export function DataPage() {
  const { dd, history, settings, breaks, queue, extract, act, importData } = useEtable();
  const toast = useToast();
  const [mode, setMode] = useState<'fusion' | 'remplacement'>('fusion');
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const doImport = (raw: string) => {
    try { importData(parseBackup(raw), mode); } catch { toast.show('Fichier illisible : ce n’est pas une sauvegarde Étable'); }
  };
  const doExport = () => {
    const url = URL.createObjectURL(new Blob([toBackup({ dd, history, settings, breaks, queue, extract })], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `etable-dragodindes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="panel" style={{ display: 'grid', gap: 14 }}>
      <p className="syncinfo" style={{ margin: 0 }}>
        Enregistré dans le cache de ce navigateur : {dd.length} DD. Vider le cache efface tout : exporte régulièrement.
      </p>
      <div>
        <button className="btn ghost" onClick={doExport}>Exporter (DD, historique, brisages et réglages)</button>
      </div>
      <fieldset>
        <legend>Importer</legend>
        <div className="bar" style={{ margin: '4px 0 10px' }}>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontWeight: 400, color: 'var(--ink)' }}>
            <input type="radio" checked={mode === 'fusion'} onChange={() => setMode('fusion')} /> Ajouter à mon étable
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontWeight: 400, color: 'var(--ink)' }}>
            <input type="radio" checked={mode === 'remplacement'} onChange={() => setMode('remplacement')} /> Remplacer mon étable
          </label>
        </div>
        <p className="note" style={{ marginTop: 0 }}>
          {mode === 'fusion'
            ? 'Les DD déjà présentes (même identifiant) sont ignorées : réimporter le même fichier ne crée pas de doublons.'
            : 'Ton étable actuelle est remplacée par celui du fichier. Annulable depuis l’historique.'}
        </p>
        <button className="btn ghost" onClick={() => file.current?.click()}>Choisir un fichier…</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) f.text().then(doImport);
          e.target.value = '';
        }} />
        <details style={{ marginTop: 10 }}>
          <summary>Coller le contenu à la place</summary>
          <textarea rows={6} style={{ width: '100%', marginTop: 8 }} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="actions"><button className="btn ghost small" onClick={() => doImport(text)}>Importer le texte</button></div>
        </details>
      </fieldset>
      <div>
        <ConfirmButton className="btn danger" confirmLabel="Confirmer l’effacement ?"
          onConfirm={() => act('effacement', `${dd.length} DD effacées`, { del: dd })}>Tout effacer</ConfirmButton>
      </div>
    </section>
  );
}
