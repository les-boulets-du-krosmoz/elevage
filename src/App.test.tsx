// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeAll(() => {
  // jsdom ne gère pas <dialog>
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const counts = () => document.querySelector('.counts')!.textContent;
async function addDD(color: string, sex: 'M' | 'F', qty: number, etat: 'Féconde' | 'Fertile' = 'Féconde') {
  fireEvent.change(screen.getByLabelText('Couleur'), { target: { value: color } });
  fireEvent.change(screen.getByLabelText('Sexe'), { target: { value: sex } });
  fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: String(qty) } });
  fireEvent.click(within(screen.getByRole('group', { name: 'État' })).getByRole('button', { name: etat }));
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
}

describe('parcours complet', () => {
  it('ajoute, accouple, annule, achète', async () => {
    render(<App />);
    await addDD('Amande', 'M', 3);
    await addDD('Dorée', 'F', 3);
    expect(counts()).toContain('6montures');

    // Accouplement depuis « Accouplements possibles »
    fireEvent.click(screen.getByRole('button', { name: /3× .*Amande × .*Dorée/ }));
    const bar = screen.getByRole('group', { name: /Résultat/ });
    fireEvent.click(within(bar).getAllByRole('button', { name: /Amande et Dorée femelle/ })[0]);
    expect(counts()).toContain('5montures');
    expect(screen.getByText('Amande et Dorée', { selector: 'td' })).toBeTruthy();
    expect(counts()).toContain('1fertiles'); // le bébé arrive fertile

    // Annulation via la notification
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(counts()).toContain('6montures');

    // Page Couples : achats et bouton Acheté, qui fait baisser le total d'exactement 1
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.change(screen.getByLabelText('Places pour les couples'), { target: { value: '10' } });
    const title = () => screen.queryByText(/À acheter : \d+ DD/)?.textContent;
    const before = Number(title()!.match(/\d+/)![0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Acheté' })[0]);
    expect(Number(title()?.match(/\d+/)?.[0] ?? 0)).toBe(before - 1);

    // Historique : l'achat apparaît et s'annule en deux clics
    fireEvent.click(screen.getByRole('tab', { name: 'Historique' }));
    const rows = document.querySelectorAll('.hrow');
    expect(rows[0].textContent).toContain('Achat');
    const undo = within(rows[0] as HTMLElement).getByRole('button', { name: 'Annuler' });
    fireEvent.click(undo);
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Confirmer ?' }));
    expect(document.querySelector('.hrow')!.className).toContain('undone');

    // La sauvegarde en cache est écrite
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(JSON.parse(localStorage.getItem('etable-dd-v1')!)).toHaveLength(6);
  });
});

describe('brisage et objets', () => {
  it('enregistre des sessions et calcule le taux de Ga PA', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    const fill = (label: string | RegExp, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
    fill('Montures brisées', '100'); fill(/^Ga PA/, '4'); fill('Cha', '300');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la session' }));
    fill('Date', '2026-10-09'); fill('Montures brisées', '60'); fill(/^Ga PA/, '4'); fill('Cha', '170');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la session' }));
    expect(screen.getByText('1 Ga PA toutes les 20 montures')).toBeTruthy();
    expect(screen.queryByText('estimation fragile')).toBeNull();
    expect(document.querySelectorAll('svg.chart').length).toBe(2);
    // Muldos : page séparée
    fireEvent.click(screen.getByRole('button', { name: 'Muldos' }));
    expect(screen.getByText(/Aucune session de brisage de muldos/)).toBeTruthy();
  });

  it('propose les sexes à imposer et trace la potion dans le journal', async () => {
    render(<App />);
    await addDD('Amande', 'M', 4);
    await addDD('Dorée', 'F', 4);
    await addDD('Rousse', 'M', 2);
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.change(screen.getByDisplayValue('Ebène et Indigo'), { target: { value: 'Ebène' } });
    expect(screen.getByText('Sexes à demander (Animakina)')).toBeTruthy();
    expect(screen.getByText(/Animakinas? ≈/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Noter un accouplement' })[0]);
    const bar = screen.getByRole('group', { name: /Résultat/ });
    fireEvent.click(within(bar).getByLabelText('Animakina utilisée (sexe choisi)'));
    fireEvent.click(within(bar).getAllByRole('button', { name: /femelle/ })[0]);
    expect(screen.getByTitle('Animakina utilisée (sexe choisi)')).toBeTruthy();
    expect(screen.getByText(/Animakinas utilisées/).textContent).toContain('1');
  });
});

describe('import', () => {
  it('importe des sessions de brisage sans DD, et l’annulation les retire', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Données' }));
    const file = JSON.stringify({ format: 'etable-dd', version: 1, dd: [], history: [], breaks: [
      { id: 'b1', date: '2026-10-08', species: 'volkorne', level: 40, mounts: 50, runes: { 'Ga PA': 13 }, created: 1 },
      { id: 'b2', date: '2026-10-08', species: 'volkorne', level: 40, mounts: 50, runes: { 'Ga PA': 14 }, created: 2 }] });
    fireEvent.click(screen.getByText('Coller le contenu à la place'));
    fireEvent.change(document.querySelector('textarea')!, { target: { value: file } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    expect(screen.getByRole('status').textContent).toContain('2 sessions de brisage');
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    expect(screen.getByText(/1 Ga PA toutes les 3,7 montures/)).toBeTruthy();
    // Réimporter le même fichier ne crée pas de doublon
    fireEvent.click(screen.getByRole('tab', { name: 'Données' }));
    fireEvent.click(screen.getByText('Coller le contenu à la place'));
    fireEvent.change(document.querySelector('textarea')!, { target: { value: file } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    expect(screen.getByRole('status').textContent).toContain('rien de nouveau');
    // Annulation depuis l'historique
    fireEvent.click(screen.getByRole('tab', { name: 'Historique' }));
    const row = document.querySelector('.hrow') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Annuler' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Confirmer ?' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    expect(screen.getByText(/Aucune session de brisage de volkornes/)).toBeTruthy();
  });
});

describe('lot 1 : fécondité et réserve', () => {
  it('sépare fécondes et fertiles, et fait passer une fertile en féconde', async () => {
    render(<App />);
    await addDD('Amande', 'M', 2, 'Fertile');
    await addDD('Dorée', 'F', 1);
    // Les fertiles ne permettent aucun accouplement
    expect(screen.getByText('Aucun croisement possible avec tes fécondes actuelles.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fertiles' }));
    expect(screen.queryByText('Dorée', { selector: 'td' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '→ féconde' })[0]);
    expect(counts()).toContain('2fécondes');
    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }));
    expect(screen.getByRole('button', { name: /1× .*Amande × .*Dorée/ })).toBeTruthy();
  });

  it('« À faire maintenant » n’utilise que les fécondes, « À préparer » compte les fertiles', async () => {
    render(<App />);
    await addDD('Amande', 'M', 1);
    await addDD('Dorée', 'F', 1);
    await addDD('Amande', 'M', 2, 'Fertile');
    await addDD('Dorée', 'F', 2, 'Fertile');
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.change(screen.getByDisplayValue('Ebène et Indigo'), { target: { value: 'Amande et Dorée' } });
    fireEvent.change(screen.getByLabelText('Places pour les couples'), { target: { value: '10' } });
    const now = screen.getByText('Croisements possibles').closest('.panel') as HTMLElement;
    expect(now.textContent).toContain('1×');
    // 10 places = 5 couples : 2 avec les 4 fertiles, 3 à acheter (6 DD)
    expect(screen.getByText(/10\/10 places/)).toBeTruthy();
    expect(screen.getByText('À acheter : 6 DD')).toBeTruthy();
  });
});

describe('lots 2 et 3 : inventaire et trois espèces', () => {
  const cell = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  const type = (label: string, v: string) => fireEvent.change(cell(label), { target: { value: v } });
  const openInventory = (tab: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name: tab }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
  };

  it('total + sexe minoritaire : l’autre sexe se calcule seul, dans les deux ordres', () => {
    render(<App />);
    openInventory(/Muldos \(0\)/);
    type('Doré total', '40');
    type('Doré ♀', '12');
    expect(cell('Doré ♂').value).toBe('28');
    type('Indigo ♂', '3');
    type('Indigo total', '10');
    expect(cell('Indigo ♀').value).toBe('7');
    expect(screen.getByText('Écarts à appliquer : +50 / −0')).toBeTruthy();
    // Sous-totaux de la génération 1 : total, ♂ et ♀
    const gen1 = [...document.querySelectorAll('tr.genrow')].find((tr) => /Génération 1 ·/.test(tr.textContent ?? '')) as HTMLElement;
    expect([...gen1.querySelectorAll('td.num')].map((td) => td.textContent)).toEqual(['50', '31', '19', '0']); // total, ♂, ♀, à briser
  });

  it('saisit un cheptel de muldos et sa file à briser, puis le recompte', () => {
    render(<App />);
    openInventory(/Muldos \(0\)/);
    type('Doré total', '20'); type('Doré ♀', '8');
    type('Doré à briser', '40');
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    expect(screen.getByRole('button', { name: /Muldos \(20\)/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('à briser +40');

    // Contrôle : on corrige ♂ de 12 à 10, et la file reste à 40
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    expect(cell('Doré ♂').value).toBe('12');
    expect(cell('Doré à briser').value).toBe('40');
    type('Doré ♂', '10');
    expect(screen.getByText('Écarts à appliquer : +0 / −2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    expect(screen.getByRole('button', { name: /Muldos \(18\)/ })).toBeTruthy();

    // La page Brisage voit la file, « Tout briser » la consomme
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Muldos' }));
    fireEvent.click(screen.getByRole('button', { name: /Tout briser \(40\)/ }));
    expect((screen.getByLabelText('Montures brisées') as HTMLInputElement).value).toBe('40');
    fireEvent.change(screen.getByLabelText(/^Ga PM/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la session' }));
    expect(screen.queryByRole('button', { name: /Tout briser/ })).toBeNull();
    // Annuler la session remet la file
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: /Tout briser \(40\)/ })).toBeTruthy();
  });

  it('le recomptage porte sur les fécondes par défaut, dans les deux sens, sans toucher aux fertiles', async () => {
    render(<App />);
    await addDD('Amande', 'M', 2);            // fécondes
    await addDD('Amande', 'M', 3, 'Fertile');
    openInventory(/Dragodindes/);
    expect(screen.queryByLabelText('Amande à briser')).toBeNull(); // pas de file pour les dragodindes
    expect(cell('Amande ♂').value).toBe('2'); // la grille part des fécondes connues
    type('Amande ♂', '5');
    expect(cell('Amande total').value).toBe('5');
    expect(screen.getByText('Écarts à appliquer : +3 / −0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    expect(counts()).toContain('5fécondes');
    expect(counts()).toContain('3fertiles');
    // À la baisse : 5 → 1 retire 4 fécondes
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    type('Amande ♂', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    expect(counts()).toContain('1fécondes');
    expect(counts()).toContain('3fertiles');
    // Le mode Fertiles part des fertiles connues
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Je compte' })).getByRole('button', { name: 'Fertiles' }));
    expect(cell('Amande ♂').value).toBe('3');
  });

  it('500 montures sur trois espèces = une seule action par espèce dans l’historique', async () => {
    render(<App />);
    const fill = (tab: RegExp, color: string, total: string, f: string) => {
      openInventory(tab);
      type(`${color} total`, total); type(`${color} ♀`, f);
      fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    };
    fill(/Muldos/, 'Doré', '350', '150');
    fill(/Volkornes/, 'Indigo', '100', '40');
    fill(/Dragodindes/, 'Amande', '50', '20');
    expect(counts()).toContain('500montures');
    expect(counts()).toContain('500fécondes');
    fireEvent.click(screen.getByRole('tab', { name: 'Historique' }));
    expect(document.querySelectorAll('.hrow')).toHaveLength(3);
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(JSON.parse(localStorage.getItem('etable-dd-v1')!)).toHaveLength(500);
  });
});

describe('lot B : calculateur d’enclos', () => {
  const card = (n: number) => screen.getByRole('article', { name: `Enclos ${n}` });
  it('6 enclos, une simulation chacun ; ajouter jusqu’à 10, retirer sans descendre sous 1', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Enclos' }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(within(card(1)).getAllByRole('listitem')).toHaveLength(1);
    expect((within(card(1)).getByRole('button', { name: 'Retirer la simulation 1' }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 9; i++) fireEvent.click(within(card(1)).getByRole('button', { name: '+ Simulation' }));
    expect(within(card(1)).getAllByRole('listitem')).toHaveLength(10);
    expect((within(card(1)).getByRole('button', { name: '+ Simulation' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(card(1)).getByRole('button', { name: 'Retirer la simulation 3' }));
    expect(within(card(1)).getAllByRole('listitem')).toHaveLength(9);
    expect(within(card(2)).getAllByRole('listitem')).toHaveLength(1);
  });

  it('−4 200 au palier 4 : rester 00:17:20, passer 00:17:30 d’un clic sur le visage violet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Enclos' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Palier des jauges' })).getByRole('button', { name: 'P4' }));
    fireEvent.change(within(card(1)).getByLabelText('Sérénité de la simulation 1'), { target: { value: '-4 200' } });
    const ligne = () => within(card(1)).getByRole('listitem');
    expect(ligne().textContent).toMatch(/00:17:(19|20)/);
    expect(ligne().textContent).toMatch(/→ -40/);
    fireEvent.click(within(ligne()).getByRole('button', { name: 'Passer en positif' }));
    expect(ligne().textContent).toMatch(/00:17:(29|30)/);
    expect(ligne().textContent).toMatch(/→ 0/);
    // Au palier 2, deux fois moins vite
    fireEvent.click(within(screen.getByRole('group', { name: 'Palier des jauges' })).getByRole('button', { name: 'P2' }));
    expect(ligne().textContent).toMatch(/00:3(4:59|5:00)/);
  });

  it('le calculateur de niveau donne une durée et le palier minimal', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Enclos' }));
    fireEvent.change(screen.getByLabelText('Niveau visé'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Délai en heures'), { target: { value: '15' } });
    expect(screen.getByText(/palier \d minimum|impossible/)).toBeTruthy();
  });
});

describe('lot C : règles de destination et file à extraire', () => {
  it('les réglages par défaut, une règle modifiée, des parents en file « À extraire », puis extraits', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Réglages' }));
    const regles = () => within(screen.getByRole('region', { name: 'Règles de destination' })).getAllByRole('listitem');
    expect(regles()).toHaveLength(4);
    // Règle 4 (dragodindes → à vendre) : à extraire
    fireEvent.change(within(regles()[3]).getByLabelText('Destination'), { target: { value: 'extraire' } });
    // Les recettes du Muldo Roux sont là, au nombre de 6
    expect(screen.getByText('G3 · 6 recettes')).toBeTruthy();

    // Accouplement de deux dragodindes de génération 2 → Indigo
    fireEvent.click(screen.getByRole('tab', { name: 'Mon étable' }));
    await addDD('Amande et Dorée', 'M', 1);
    await addDD('Amande et Rousse', 'F', 1);
    fireEvent.click(screen.getByRole('button', { name: /1× .*Amande et Dorée × .*Amande et Rousse/ }));
    const bar = screen.getByRole('group', { name: /Résultat/ });
    fireEvent.click(within(bar).getAllByRole('button', { name: /Indigo femelle/ })[0]);
    expect(screen.getByRole('status').textContent).toContain('parents : 2 à extraire');

    // Page Brisage : 2 dragodindes de génération 2 → 4 ressources ; « Extraites » vide la file, et s'annule
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    const panel = screen.getByRole('region', { name: 'À extraire' });
    expect(panel.textContent).toContain('2 montures → 4 ressources');
    fireEvent.click(within(panel).getByRole('button', { name: 'Extraites (2)' }));
    expect(screen.queryByRole('region', { name: 'À extraire' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('region', { name: 'À extraire' })).toBeTruthy();
  });

  it('une recette ajoutée remplace celle de DPLN, et se rétablit', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Réglages' }));
    const roux = screen.getByText('Roux', { selector: 'b' }).closest('details') as HTMLElement;
    fireEvent.click(within(roux).getByRole('button', { name: /Retirer Doré et Pourpre \+ Doré et Indigo/ }));
    expect(within(roux).getByText('G3 · 5 recettes')).toBeTruthy();
    expect(within(roux).getByText('modifiée')).toBeTruthy();
    fireEvent.change(within(roux).getByLabelText('Premier parent de Roux'), { target: { value: 'Doré' } });
    fireEvent.change(within(roux).getByLabelText('Second parent de Roux'), { target: { value: 'Pourpre' } });
    fireEvent.click(within(roux).getByRole('button', { name: 'Ajouter' }));
    expect(within(roux).getByText(/Deux bicolores plus jeunes/)).toBeTruthy();
    fireEvent.click(within(roux).getByRole('button', { name: 'Rétablir DPLN' }));
    expect(within(roux).getByText('G3 · 6 recettes')).toBeTruthy();
  });
});

describe('lot D : plan d’accouplement par génération', () => {
  it('inventaire des fécondes, plan équilibré pour le Roux et l’Amande, puis un lot validé en partie avec ses naissances', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Muldos \(0\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    const type = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
    type('Doré ♂', '10'); type('Indigo ♂', '5'); type('Ebène ♂', '5'); type('Orchidée ♀', '10'); type('Pourpre ♀', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Espèce' })).getByRole('button', { name: 'Muldos' }));
    const visees = screen.getByRole('group', { name: 'Monocolores visées' });
    expect(within(visees).getByRole('button', { name: /Roux/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(visees).getByRole('button', { name: /Amande/ }).getAttribute('aria-pressed')).toBe('true');
    const plan = () => screen.getByRole('region', { name: 'Plan de la session' });
    expect(plan().textContent).toContain('Session : 20 couples');
    for (const l of ['Doré × Orchidée', 'Doré × Pourpre', 'Indigo × Pourpre', 'Ebène × Orchidée']) {
      expect(within(plan()).getByRole('group', { name: `Lot ${l}` }).textContent).toMatch(/^5×/);
    }

    // 3 accouplements Doré × Orchidée faits sur 5 : 2 Doré et Orchidée ♀ et 1 Doré ♂
    const lot = within(plan()).getByRole('group', { name: 'Lot Doré × Orchidée' });
    fireEvent.click(within(lot).getByRole('button', { name: 'Faits…' }));
    fireEvent.change(within(lot).getByLabelText('Accouplements faits'), { target: { value: '3' } });
    fireEvent.change(within(lot).getByLabelText('Naissances Doré et Orchidée ♀'), { target: { value: '2' } });
    fireEvent.change(within(lot).getByLabelText('Naissances Doré ♂'), { target: { value: '1' } });
    fireEvent.click(within(lot).getByRole('button', { name: 'Valider 3 accouplements' }));
    expect(screen.getByRole('status').textContent).toContain('3 × Doré ♂ × Orchidée ♀ → 2 Doré et Orchidée, 1 Doré · parents : 6 à briser');
    // 34 fécondes restent, 17 de chaque sexe ; les bébés arrivent fertiles
    expect(plan().textContent).toContain('Session : 17 couples');
    expect(counts()).toContain('3fertiles');
  });

  it('refuse un nombre de naissances impossible', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Muldos \(0\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    fireEvent.change(screen.getByLabelText('Doré ♂'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Pourpre ♀'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Espèce' })).getByRole('button', { name: 'Muldos' }));
    const lot = screen.getByRole('group', { name: 'Lot Doré × Pourpre' });
    fireEvent.click(within(lot).getByRole('button', { name: 'Faits…' }));
    fireEvent.change(within(lot).getByLabelText('Naissances Doré ♂'), { target: { value: '5' } });
    fireEvent.click(within(lot).getByRole('button', { name: 'Valider 2 accouplements' }));
    expect(within(lot).getByText(/entre 2 et 4 bébés/)).toBeTruthy();
  });
});

describe('lot E : sexes, Optimakina, montures à retenir', () => {
  const inventaire = (lignes: [string, string][], fertiles = false) => {
    fireEvent.click(screen.getByRole('tab', { name: 'Mon étable' }));
    fireEvent.click(screen.getByRole('button', { name: /^Muldos \(/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventaire' }));
    if (fertiles) fireEvent.click(within(screen.getByRole('group', { name: 'Je compte' })).getByRole('button', { name: 'Fertiles' }));
    for (const [l, v] of lignes) fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider l\'inventaire' }));
  };
  const couplesMuldos = () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Espèce' })).getByRole('button', { name: 'Muldos' }));
  };

  it('verdict de l’Optimakina selon son prix, et Animakina proposée quand un sexe manque', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Réglages' }));
    fireEvent.change(screen.getByLabelText('Optimakina Muldos G2'), { target: { value: '12000' } });
    inventaire([['Doré et Pourpre ♂', '15']], true);
    inventaire([['Doré ♂', '10'], ['Orchidée ♀', '10']]);
    couplesMuldos();
    const lot = screen.getByRole('group', { name: 'Lot Doré × Orchidée' });
    expect(lot.textContent).toMatch(/pas rentable à 12\s000 kamas \(seuil 8\s000 kamas\)/);
    const sexes = screen.getByRole('region', { name: 'Sexes à cibler' });
    expect(sexes.textContent).toMatch(/Animakina\s+sur 10 accouplements/);
    expect(sexes.textContent).toContain("attendent des femelles Doré et Orchidée pour faire du Roux");
    expect(sexes.textContent).toContain('15');
  });

  it('naissances : un bébé tombé plus bas est à tester, un reproducteur est noté, chacun avec un nom pour le jeu', () => {
    render(<App />);
    inventaire([['Doré et Pourpre ♂', '1'], ['Doré et Orchidée ♀', '1']]);
    couplesMuldos();
    const lot = screen.getByRole('group', { name: 'Lot Doré et Pourpre × Doré et Orchidée' });
    fireEvent.click(within(lot).getByRole('button', { name: 'Faits…' }));
    fireEvent.change(within(lot).getByLabelText('Naissances Roux ♀'), { target: { value: '1' } });
    fireEvent.change(within(lot).getByLabelText('Autre couleur'), { target: { value: 'Doré' } });
    fireEvent.change(within(lot).getByLabelText('Naissances Doré ♂'), { target: { value: '1' } });
    fireEvent.change(within(lot).getByLabelText('Bébé reproducteur'), { target: { value: 'Roux|F' } });
    fireEvent.click(within(lot).getByRole('button', { name: '+ Reproducteur' }));
    fireEvent.click(within(lot).getByRole('button', { name: 'Valider 1 accouplement' }));
    expect(screen.getByRole('status').textContent).toContain('à nommer en jeu : R-Rou-01, T-Dor-01');
    const retenir = screen.getByRole('region', { name: 'À retenir' });
    expect(retenir.textContent).toContain('R-Rou-01');
    expect(retenir.textContent).toContain('T-Dor-01');
    expect(retenir.textContent).toMatch(/À tester avec .*Roux possible/);
  });
});

describe('brisage v2 : recherche de rune, prix, objectif', () => {
  it('ajoute une rune par son nom, valorise la session et calcule un objectif', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Brisage' }));
    fireEvent.change(screen.getByLabelText('Chercher une rune'), { target: { value: 'ré per a' } });
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Runes trouvées' })).getByRole('option', { name: 'Ré Per Air' }));
    const runesObtenues = screen.getByRole('group', { name: 'Runes obtenues' });
    fireEvent.change(within(runesObtenues).getByLabelText('Ré Per Air'), { target: { value: '12' } });
    fireEvent.change(within(runesObtenues).getByLabelText(/^Ga PA/), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Montures brisées'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la session' }));
    // Prix : 50 000 la Ga PA → 1 500 000 kamas, 15 000 par monture, sans la Ré Per Air
    fireEvent.change(screen.getByLabelText('Prix Ga PA'), { target: { value: '50000' } });
    expect(document.querySelector('.valeur')!.textContent).toMatch(/1\s500\s000 kamas \(15\s000 kamas par monture\), sans Ré Per Air/);
    // Objectif : 100 Ga PA à 0,3 par monture → environ 333 volkornes
    const obj = screen.getByRole('region', { name: 'Objectif de runes' });
    expect(obj.textContent).toMatch(/≈ 333 volkornes/);
    expect(obj.textContent).toContain('valeur visée');
    // Une rune inconnue est refusée
    fireEvent.change(screen.getByLabelText('Chercher une rune'), { target: { value: 'bidule' } });
    expect(screen.getByText('aucune rune de ce nom')).toBeTruthy();
  });
});

describe('Familiers', () => {
  it('cherche par bonus, simule 4 croquettes sur un Tifoux et montre son bonus', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Familiers' }));
    fireEvent.change(screen.getByLabelText('Chercher un familier'), { target: { value: 'prospection' } });
    const liste = screen.getByRole('region', { name: 'Liste des familiers' });
    const tifoux = within(liste).getByRole('listitem', { name: 'Tifoux' });
    expect(tifoux.textContent).toContain('Niv. 1 : 12 Prospection');
    expect(tifoux.textContent).toContain('[16,-35]');
    expect(within(liste).queryByRole('listitem', { name: 'Abra Kadabra' })).toBeNull();
    fireEvent.click(within(tifoux).getByRole('button', { name: 'Simuler' }));
    expect((screen.getByLabelText('Familier simulé') as HTMLSelectElement).value).toBe('Tifoux');
    fireEvent.change(screen.getByLabelText('Croquettes enrichies'), { target: { value: '4' } });
    expect(screen.getByLabelText('Résultat').textContent).toMatch(/Niveau 0 → 51/);
    const bonus = screen.getByRole('table', { name: 'Bonus du familier' });
    expect(bonus.textContent).toContain('61');
    expect(screen.getByLabelText('Objectif').textContent).toMatch(/360 croquettes enrichies/);
  });
});

describe('Familiers : arrondi et bibliothèque', () => {
  it('importe une table, remplit l’XP par le nom, montre la perte et ajuste la quantité', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Familiers' }));
    fireEvent.change(screen.getByLabelText('Table de ressources'), { target: { value: 'Rose des sables\t1,25\nEau calme\t0,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }));
    expect(screen.getByText(/2 ressources importées/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Ressource' }));
    fireEvent.change(screen.getByLabelText('Ressource 1'), { target: { value: 'rose des sables' } });
    expect((screen.getByLabelText('XP par unité 1') as HTMLInputElement).value).toBe('1,25');
    fireEvent.change(screen.getByLabelText('Quantité 1'), { target: { value: '99' } });
    const arrondi = screen.getByLabelText('Arrondi 1');
    expect(arrondi.textContent).toMatch(/0,75 XP perdue à l'arrondi · sans perte par multiples de 4/);
    fireEvent.click(within(arrondi).getByRole('button', { name: 'Ajuster à 96' }));
    expect((screen.getByLabelText('Quantité 1') as HTMLInputElement).value).toBe('96');
    expect(screen.getByLabelText('Arrondi 1').textContent).toContain('aucune perte');
  });
});

describe('Familiers : ressources à vérifier', () => {
  it('table intégrée : valeurs approximatives signalées, peu rentables écartées, valeur vérifiée retenue', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Familiers' }));
    const resume = () => document.querySelector('.averifier summary')!.textContent!;
    const avant = Number(resume().match(/À vérifier en jeu : (\d+)/)![1]);
    expect(avant).toBeGreaterThan(50);

    fireEvent.click(screen.getByRole('button', { name: '+ Ressource' }));
    fireEvent.change(screen.getByLabelText('Ressource 1'), { target: { value: 'Pince de Crabe Hijacob' } });
    expect((screen.getByLabelText('XP par unité 1') as HTMLInputElement).value).toBe('0,333');
    expect(screen.getByLabelText('Fiabilité 1').textContent).toMatch(/valeur approximative, la table donne 1 XP pour 3 \(entre 0,333 et 0,667 par unité\)/);
    // Relevé en jeu : 0,5 XP par pince
    fireEvent.change(screen.getByLabelText('XP par unité 1'), { target: { value: '0,5' } });
    fireEvent.click(within(screen.getByLabelText('Fiabilité 1')).getByRole('button', { name: '0,5 XP vérifiée en jeu' }));
    expect(screen.getByLabelText('Fiabilité 1').textContent).toContain('✓ XP vérifiée en jeu');
    expect(resume()).toMatch(new RegExp(`À vérifier en jeu : ${avant - 1} sur .*1 déjà vérifiées`));
    // Peu rentable : signalée sans alerte
    fireEvent.change(screen.getByLabelText('Ressource 1'), { target: { value: 'Rune Age' } });
    expect(screen.getByLabelText('Fiabilité 1').textContent).toMatch(/Peu rentable : la table donne 1 XP pour 11, soit 0,091 XP par unité/);
    // Une ressource fiable n'affiche rien
    fireEvent.change(screen.getByLabelText('Ressource 1'), { target: { value: 'Rune Ga Pa' } });
    expect(screen.queryByLabelText('Fiabilité 1')).toBeNull();
    // Une table importée complète la table intégrée
    fireEvent.change(screen.getByLabelText('Table de ressources'), { target: { value: 'Ressource\tExpérience\tQuantitée\nMuseau de Rat Luisant\t2\t1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importer' }));
    fireEvent.change(screen.getByLabelText('Ressource 1'), { target: { value: 'Museau de Rat Luisant' } });
    expect((screen.getByLabelText('XP par unité 1') as HTMLInputElement).value).toBe('2');
  });
});

describe('Familiers : mes ressources', () => {
  it('favoris, valeur à l’unité, tri par rentabilité, prix ou gain d’XP, et « Utiliser »', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Familiers' }));
    const table = () => screen.getByRole('table', { name: 'Comparaison des ressources' });
    const ordre = () => within(table()).getAllByRole('row').slice(1).map((r) => r.getAttribute('aria-label'));
    // La croquette enrichie est toujours là : 4 000 kamas → 8 kamas par XP, 360 pour le niveau 100
    fireEvent.change(screen.getByLabelText('Valeur Croquette enrichie'), { target: { value: '4000' } });
    const croq = within(table()).getByRole('row', { name: 'Croquette enrichie' });
    expect(croq.textContent).toMatch(/500.*8.*360.*1\s440\s000 kamas/);
    // Rose des sables en favori, à 5 kamas : 4 kamas par XP, elle passe devant
    fireEvent.change(screen.getByLabelText('Ajouter une ressource aux favoris'), { target: { value: 'rose des sables' } });
    fireEvent.click(screen.getByRole('button', { name: '★ Ajouter' }));
    fireEvent.change(screen.getByLabelText('Valeur Rose des sables'), { target: { value: '5' } });
    expect(ordre()).toEqual(['Rose des sables', 'Croquette enrichie']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Trier par' })).getByRole('button', { name: "Gain d'XP" }));
    expect(ordre()).toEqual(['Croquette enrichie', 'Rose des sables']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Trier par' })).getByRole('button', { name: 'Prix' }));
    expect(ordre()).toEqual(['Rose des sables', 'Croquette enrichie']);
    // « Utiliser » ajoute la ressource au simulateur avec la quantité pour le niveau 100
    fireEvent.click(within(within(table()).getByRole('row', { name: 'Rose des sables' })).getByRole('button', { name: 'Utiliser' }));
    expect((screen.getByLabelText('Ressource 1') as HTMLInputElement).value).toBe('Rose des sables');
    expect((screen.getByLabelText('Quantité 1') as HTMLInputElement).value).toBe('143674');
    expect(screen.getByLabelText('Résultat').textContent).toMatch(/Niveau 0 → 100/);
    // L'étoile de la ligne retire le favori
    const etoiles = screen.getAllByRole('button', { name: 'Retirer des favoris : Rose des sables' });
    expect(etoiles).toHaveLength(2); // dans le tableau et sur la ligne du simulateur
    fireEvent.click(etoiles[1]);
    expect(ordre()).toEqual(['Croquette enrichie']);
  });
});
