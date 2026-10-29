// gedcom-exporter.js - GEDCOM 5.5.1 export of the current family tree.

import { notifications } from '../../ui/components/notifications.js';
import { downloadBlob } from './download.js';

// Advanced GEDCOM Export
export async function exportGEDCOM() {
  const loadingId = notifications.loading('Exporting GEDCOM...', 'Generating genealogy file');
  
  try {
    // Use global tree core instead of importing
    const treeCore = window.treeCore;
    
    if (!treeCore.renderer || !treeCore.renderer.nodes || treeCore.renderer.nodes.size === 0) {
      notifications.remove(loadingId);
      notifications.warning('No Data', 'No family tree data available to export');
      return;
    }
    
    const gedcomData = generateGEDCOM(treeCore);
    const blob = new Blob([gedcomData], { type: 'text/plain;charset=utf-8' });
    
    downloadBlob(blob, `family-tree-${new Date().toISOString().split('T')[0]}.ged`);
    
    notifications.remove(loadingId);
    notifications.success('GEDCOM Export Complete', 'Genealogy file has been downloaded successfully');
    
  } catch (error) {
    console.error('GEDCOM export error:', error);
    notifications.remove(loadingId);
    notifications.error('GEDCOM Export Failed', 'Error generating GEDCOM file');
  }
}

// Pure GEDCOM generator — takes a flat array of person objects
export function generateGEDCOMText(persons) {
  const lines = [];
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

  lines.push('0 HEAD');
  lines.push('1 SOUR MapMyRoots');
  lines.push('2 VERS 2.5');
  lines.push('2 NAME MapMyRoots Family Tree Builder');
  lines.push('1 DEST GENERIC');
  lines.push('1 DATE ' + currentDate);
  lines.push('1 CHAR UTF-8');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');

  let indiCounter = 1;
  let famCounter = 1;
  const idToGedId = new Map();
  for (const p of persons) idToGedId.set(p.id, `@I${indiCounter++}@`);

  // INDI records
  for (const p of persons) {
    const gedId = idToGedId.get(p.id);
    lines.push(`0 ${gedId} INDI`);

    const givenName = p.name || '';
    const surname = p.surname || '';
    lines.push(`1 NAME ${givenName} /${surname}/`.trim());
    if (givenName) lines.push(`2 GIVN ${givenName}`);
    if (surname) lines.push(`2 SURN ${surname}`);

    if (p.gender === 'female' && p.maidenName) {
      lines.push(`1 NAME ${givenName} /${p.maidenName}/`);
      lines.push(`2 GIVN ${givenName}`);
      lines.push(`2 SURN ${p.maidenName}`);
      lines.push(`2 TYPE maiden`);
    }

    if (p.gender === 'male') lines.push('1 SEX M');
    else if (p.gender === 'female') lines.push('1 SEX F');

    const birth = p.birth || {};
    if (birth.date?.year || birth.place || birth.note) {
      lines.push('1 BIRT');
      if (birth.date?.year) lines.push(`2 DATE ${formatDateValueToGEDCOM(birth.date)}`);
      if (birth.place) lines.push(`2 PLAC ${birth.place}`);
      if (birth.note) lines.push(`2 NOTE ${birth.note}`);
    }

    const death = p.death || {};
    if (death.date?.year || death.place || death.note) {
      lines.push('1 DEAT');
      if (death.date?.year) lines.push(`2 DATE ${formatDateValueToGEDCOM(death.date)}`);
      if (death.place) lines.push(`2 PLAC ${death.place}`);
      if (death.note) lines.push(`2 NOTE ${death.note}`);
    }

    if (p.fatherName) {
      lines.push('1 NOTE');
      lines.push(`2 CONT Father's name: ${p.fatherName}`);
    }
  }

  // FAM records
  const processedFamilies = new Set();

  for (const p of persons) {
    const pGedId = idToGedId.get(p.id);

    // Marriage-based FAM
    for (const marriage of (p.marriages || [])) {
      if (processedFamilies.has(marriage.id)) continue;
      processedFamilies.add(marriage.id);

      const spouseGedId = idToGedId.get(marriage.spouseId);
      if (!spouseGedId) continue;

      const famId = `@F${famCounter++}@`;
      lines.push(`0 ${famId} FAM`);

      if (p.gender === 'female') {
        lines.push(`1 WIFE ${pGedId}`);
        lines.push(`1 HUSB ${spouseGedId}`);
      } else {
        lines.push(`1 HUSB ${pGedId}`);
        lines.push(`1 WIFE ${spouseGedId}`);
      }

      if (marriage.date?.year || marriage.place || marriage.note) {
        lines.push('1 MARR');
        if (marriage.date?.year) lines.push(`2 DATE ${formatDateValueToGEDCOM(marriage.date)}`);
        if (marriage.place) lines.push(`2 PLAC ${marriage.place}`);
        if (marriage.note) lines.push(`2 NOTE ${marriage.note}`);
      }

      const spouseId = marriage.spouseId;
      for (const child of persons) {
        const bothParents =
          (child.fatherId === p.id && child.motherId === spouseId) ||
          (child.motherId === p.id && child.fatherId === spouseId);
        if (bothParents) {
          const cGedId = idToGedId.get(child.id);
          if (cGedId) lines.push(`1 CHIL ${cGedId}`);
        }
      }
    }

    // Fallback: spouseId with no marriages (legacy data)
    if ((!p.marriages || p.marriages.length === 0) && p.spouseId) {
      const famKey = [p.id, p.spouseId].sort().join('-');
      if (!processedFamilies.has(famKey)) {
        processedFamilies.add(famKey);
        const spouseGedId = idToGedId.get(p.spouseId);
        if (spouseGedId) {
          const famId = `@F${famCounter++}@`;
          lines.push(`0 ${famId} FAM`);
          if (p.gender === 'female') {
            lines.push(`1 WIFE ${pGedId}`);
            lines.push(`1 HUSB ${spouseGedId}`);
          } else {
            lines.push(`1 HUSB ${pGedId}`);
            lines.push(`1 WIFE ${spouseGedId}`);
          }
        }
      }
    }

    // Parent-child FAM for single-parent or orphaned children
    if (p.motherId || p.fatherId) {
      const familyKey = `${p.fatherId || 'none'}-${p.motherId || 'none'}`;
      if (!processedFamilies.has(familyKey)) {
        processedFamilies.add(familyKey);
        const fatherGedId = p.fatherId ? idToGedId.get(p.fatherId) : null;
        const motherGedId = p.motherId ? idToGedId.get(p.motherId) : null;
        if (fatherGedId || motherGedId) {
          const famId = `@F${famCounter++}@`;
          lines.push(`0 ${famId} FAM`);
          if (fatherGedId) lines.push(`1 HUSB ${fatherGedId}`);
          if (motherGedId) lines.push(`1 WIFE ${motherGedId}`);
          lines.push(`1 CHIL ${pGedId}`);
          for (const sibling of persons) {
            if (sibling.id !== p.id && sibling.fatherId === p.fatherId && sibling.motherId === p.motherId) {
              const sibGedId = idToGedId.get(sibling.id);
              if (sibGedId) lines.push(`1 CHIL ${sibGedId}`);
            }
          }
        }
      }
    }
  }

  lines.push('0 TRLR');
  return lines.join('\n');
}

// Collect persons from treeCore and delegate to pure generator
function generateGEDCOM(treeCore) {
  const persons = [];
  for (const [id, node] of treeCore.renderer.nodes) {
    const pd = treeCore.getPersonData(id) || {};
    persons.push({
      id,
      name: node.name || pd.name || '',
      surname: node.surname || pd.surname || '',
      fatherName: node.fatherName || pd.fatherName || '',
      maidenName: node.maidenName || pd.maidenName || '',
      gender: node.gender || pd.gender || '',
      motherId: pd.motherId || '',
      fatherId: pd.fatherId || '',
      spouseId: pd.spouseId || '',
      birth: pd.birth || { date: null, place: '', note: '' },
      death: pd.death || { date: null, place: '', note: '' },
      marriages: pd.marriages || [],
      notes: pd.notes || '',
    });
  }
  return generateGEDCOMText(persons);
}

function formatDateValueToGEDCOM(dv) {
  if (!dv || !dv.year) return '';
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  let date;
  if (dv.day && dv.month) {
    date = `${dv.day} ${MONTHS[dv.month - 1]} ${dv.year}`;
  } else if (dv.month) {
    date = `${MONTHS[dv.month - 1]} ${dv.year}`;
  } else {
    date = `${dv.year}`;
  }
  return dv.estimated ? `ABT ${date}` : date;
}
