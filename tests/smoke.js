// Tests de bout en bout exécutés DANS la page (injectés par tests/run.mjs).
// Chaque vérification produit une ligne « PASS nom » ou « FAIL nom : détail » dans <pre id="testout">.
(async () => {
  const out = [];
  const check = (name, ok, detail = '') => out.push((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' : ' + detail));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const count = arr => arr.reduce((a, v) => a + (v ? 1 : 0), 0);

  try {
    // ---------- Interface au chargement ----------
    const nums = [...document.querySelectorAll('input.num')];
    const empty = nums.filter(n => n.value === '' || n.value !== document.getElementById(n.dataset.num).value);
    check('champs numériques remplis au chargement', nums.length >= 10 && !empty.length,
      `${nums.length} champs, vides ou désynchronisés : ${empty.map(n => n.dataset.num).join(', ')}`);
    check('nom de l\'outil affiché', $('#toolName').textContent === 'Pinceau', $('#toolName').textContent);

    // ---------- Chargement d'une image (dégradé horizontal noir → blanc) ----------
    const c = document.createElement('canvas'); c.width = 200; c.height = 280;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 200, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, 200, 280);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    setSource(img, 'test');
    check('image chargée', W === 200 && H === 280, `${W}x${H}`);
    const cov = count(autoMask) / N;
    check('génération auto ≈ moitié blanche (seuil 128)', cov > 0.4 && cov < 0.6, cov.toFixed(3));

    // ---------- Simulation souris ----------
    cv.setPointerCapture = () => {};           // pointerId synthétique refusé sinon
    const at = (ix, iy) => { const r = cv.getBoundingClientRect(); return { clientX: r.left + view.panX + ix * view.zoom, clientY: r.top + view.panY + iy * view.zoom }; };
    const pe = (type, ix, iy, o = {}) => cv.dispatchEvent(new PointerEvent(type, { ...at(ix, iy), button: 0, pointerId: 1, bubbles: true, ...o }));
    const click = async (ix, iy, o) => { pe('pointermove', ix, iy); pe('pointerdown', ix, iy, o); pe('pointerup', ix, iy, o); await wait(450); };
    const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    // ---------- Pinceau ----------
    setTool('brush'); setPaint(1); setSize(10);
    pe('pointerdown', 190, 100); pe('pointermove', 190, 140); pe('pointerup', 190, 140);
    check('pinceau noir sur zone blanche', over[120 * W + 190] === 1 && finalAt(120 * W + 190) === 0);
    undo();
    check('annuler le pinceau', count(over) === 0, count(over) + ' px retouchés');

    // ---------- Lasso polygonal → zone (fermeture par Entrée) ----------
    setTool('lasso'); setLassoAction('zone'); setLassoMode('poly');
    await click(20, 20); await click(100, 20); await click(60, 120);
    check('lasso polygonal : polygone en cours', poly && poly.pts.length === 3, poly ? poly.pts.length : 'null');
    key('Enter');
    check('lasso polygonal + Entrée crée une zone', zones.length === 1 && !poly, `${zones.length} zones`);

    // ---------- Retour arrière + fermeture par clic sur le 1er point ----------
    await click(120, 150); await click(180, 150); await click(170, 170); key('Backspace');
    check('retour arrière retire un point', poly && poly.pts.length === 2, poly ? poly.pts.length : 'null');
    await click(150, 250); await click(120, 150);
    check('clic sur le 1er point ferme le polygone', zones.length === 2 && !poly, `${zones.length} zones`);

    // ---------- Double-clic ----------
    await click(10, 160); await click(60, 160);
    pe('pointerdown', 30, 190); pe('pointerup', 30, 190); await wait(80);
    pe('pointerdown', 30, 190); pe('pointerup', 30, 190);
    check('double-clic ferme le polygone', zones.length === 3 && !poly, `${zones.length} zones`);

    // ---------- Échap annule ----------
    await click(5, 5); await click(30, 5); key('Escape');
    check('Échap annule le polygone', !poly && zones.length === 3);

    // ---------- Lasso libre → zone ----------
    setLassoMode('free');
    pe('pointerdown', 10, 200); pe('pointermove', 60, 200); pe('pointermove', 60, 260); pe('pointermove', 10, 260); pe('pointerup', 10, 260);
    check('lasso libre crée une zone', zones.length === 4, `${zones.length} zones`);
    check('numérotation des zones', zones.map(z => z.num).join(',') === '1,2,3,4', zones.map(z => z.name).join('|'));
    deleteZone(zones[1]);
    pe('pointerdown', 150, 60); pe('pointermove', 190, 60); pe('pointermove', 190, 90); pe('pointerup', 150, 90);
    check('le numéro libéré est réutilisé', zones[zones.length - 1].name === 'Zone 2', zones[zones.length - 1].name);

    // ---------- Réglages propres à une zone ----------
    const z = zones[0];
    selectZone(z);
    $('#lo').value = 0; $('#lo').dispatchEvent(new Event('input')); generate();
    const inside = 22 * W + 25;            // pixel sombre à l'intérieur de la zone 1
    check('les réglages d\'une zone s\'appliquent dedans', autoMask[inside] === 1, `autoMask=${autoMask[inside]}`);
    check('… et pas dehors', autoMask[270 * W + 25] === 0);
    check('l\'image entière garde son seuil', globalParams.lo === 128, globalParams.lo);

    // ---------- Inverser la zone ----------
    const before = count(z.mask);
    invertZone(z);
    check('inverser la zone', count(z.mask) === N - before && z.x0 === 0 && z.x1 === W, `${before} + ${count(z.mask)} ≠ ${N}`);
    invertZone(z);
    check('inverser deux fois = zone d\'origine', count(z.mask) === before);

    // ---------- Clic droit → menu ----------
    pe('pointerdown', 40, 40, { button: 2 });
    const ctx = $('#ctx');
    check('clic droit en mode zone ouvre le menu', !ctx.classList.contains('hidden') && /Inverser la zone/.test(ctx.textContent), ctx.textContent);
    const inv0 = activeZone.params.inv;
    [...ctx.querySelectorAll('button')].find(b => b.textContent.startsWith('Inverser blanc')).click();
    check('menu : inverser blanc ↔ noir', activeZone.params.inv === !inv0 && $('#inv').checked === !inv0);
    check('menu fermé après action', ctx.classList.contains('hidden'));

    // ---------- Lasso en mode peindre ----------
    setLassoAction('paint'); setPaint(2);
    pe('pointerdown', 150, 10); pe('pointermove', 190, 10); pe('pointermove', 190, 50); pe('pointerup', 150, 50);
    check('lasso en mode peindre : retouches, pas de zone', count(over) > 0 && over[30 * W + 175] === 2, count(over) + ' px');
    pe('pointerdown', 100, 100, { button: 2 }); pe('pointerup', 100, 100, { button: 2 });
    check('clic droit en mode peindre : pas de menu', $('#ctx').classList.contains('hidden'));

    // ---------- Baguette magique ----------
    const nz = zones.length;
    setTool('wand'); setWandMode('zone'); setTol(10);
    await click(5, 270);
    check('baguette → zone', zones.length === nz + 1, `${zones.length} zones`);
    setWandMode('paint'); setPaint(1);
    const edits = count(over); await click(195, 270);
    check('baguette → peindre', count(over) > edits);

    // ---------- Champs numériques ----------
    selectZone(null);
    const n = document.querySelector('input.num[data-num="lo"]');
    n.value = '77'; n.dispatchEvent(new Event('change'));
    check('champ numérique → curseur et réglages', $('#lo').value === '77' && globalParams.lo === 77, `${$('#lo').value} / ${globalParams.lo}`);
    n.value = '999'; n.dispatchEvent(new Event('change'));
    check('champ numérique borné au max', $('#lo').value === '255' && n.value === '255', n.value);
    $('#blur').value = 3; $('#blur').dispatchEvent(new Event('input'));
    check('curseur → champ numérique', document.querySelector('input.num[data-num="blur"]').value === '3');
    setSize(57);
    check('taille du pinceau → champ', document.querySelector('input.num[data-num="size"]').value === '57');

    // ---------- Export ----------
    const m = maskCanvas(), r = resizeTo(m, 163, 222, 'stretch', true);
    const d = r.getContext('2d').getImageData(0, 0, 163, 222).data;
    let pure = true; for (let p = 0; p < d.length; p += 4) if ((d[p] !== 0 && d[p] !== 255) || d[p + 3] !== 255) { pure = false; break; }
    check('export redimensionné en noir et blanc pur', pure);

    // ---------- Barre d'outils ----------
    setTool('wand');
    check('options baguette visibles', !document.querySelector('[data-for="wand"]').classList.contains('hidden'));
    check('options pinceau cachées', document.querySelector('[data-for="brush"]').classList.contains('hidden'));
  } catch (e) {
    check('exception', false, e.message + '\n' + e.stack);
  }
  const pre = document.createElement('pre');
  pre.id = 'testout'; pre.textContent = out.join('\n') + '\nEND';
  document.body.appendChild(pre);
})();
