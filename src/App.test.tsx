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
async function addDD(color: string, sex: 'M' | 'F', qty: number) {
  fireEvent.change(screen.getByLabelText('Couleur'), { target: { value: color } });
  fireEvent.change(screen.getByLabelText('Sexe'), { target: { value: sex } });
  fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: String(qty) } });
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
}

describe('parcours complet', () => {
  it('ajoute, accouple, annule, achète', async () => {
    render(<App />);
    await addDD('Amande', 'M', 3);
    await addDD('Dorée', 'F', 3);
    expect(counts()).toContain('6DD');

    // Accouplement depuis « Accouplements possibles »
    fireEvent.click(screen.getByRole('button', { name: /3× .*Amande × .*Dorée/ }));
    const bar = screen.getByRole('group', { name: /Résultat/ });
    fireEvent.click(within(bar).getAllByRole('button', { name: /Amande et Dorée ♀/ })[0]);
    expect(counts()).toContain('5DD');
    expect(screen.getByText('Amande et Dorée', { selector: 'td' })).toBeTruthy();

    // Annulation via la notification
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(counts()).toContain('6DD');

    // Page Couples : achats et bouton Acheté
    fireEvent.click(screen.getByRole('tab', { name: 'Couples' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } });
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
