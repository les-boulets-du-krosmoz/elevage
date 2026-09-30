import { useEtable } from '../store/EtableContext';
import { ConfirmButton } from './ui';

const TAGS: Record<string, string> = { ajout: 'Ajout', retrait: 'Retrait', achat: 'Achat', accouplement: 'Accouplement', import: 'Import', effacement: 'Effacement' };
const fmt = (t: number) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function HistoryPage() {
  const { history, undo } = useEtable();
  const list = [...history].sort((a, b) => b.t - a.t).slice(0, 300);
  return (
    <section className="panel">
      <p className="note" style={{ marginTop: 0 }}>
        Toutes tes actions, de la plus récente à la plus ancienne. « Annuler » remet l'enclos comme avant cette action : les DD retirées reviennent,
        celles ajoutées repartent. Un bébé déjà utilisé comme parent depuis n'est pas retiré.
      </p>
      {!list.length && <p className="muted">Aucune action pour l'instant.</p>}
      {list.map((h) => (
        <div key={h.id} className={`hrow${h.undone ? ' undone' : ''}`}>
          <span className="when">{fmt(h.t)}</span>
          <span className="tag">{TAGS[h.type] ?? h.type}</span>
          <span className="lbl">{h.label}</span>
          {h.undone
            ? <span className="muted" style={{ marginLeft: 'auto', fontSize: '.85rem' }}>annulé le {fmt(h.undoneAt ?? h.t)}</span>
            : <ConfirmButton onConfirm={() => undo(h.id)}>Annuler</ConfirmButton>}
        </div>
      ))}
    </section>
  );
}
