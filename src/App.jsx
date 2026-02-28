import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Users, BedDouble, Plus, Printer, Wand2, Info, ListChecks, Lock, Unlock, RefreshCw, Eraser, AlertTriangle, CheckCircle2, UserMinus, Map as MapIcon, UserCheck, X } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

const initialNurses = [
  { id: 1, noChemo: false, name: 'RN 1', locked: false },
  { id: 2, noChemo: false, name: 'RN 2', locked: false },
  { id: 3, noChemo: false, name: 'RN 3', locked: false },
  { id: 4, noChemo: false, name: 'RN 4', locked: false },
  { id: 5, noChemo: false, name: 'RN 5', locked: false },
  { id: 6, noChemo: false, name: 'RN 6', locked: false },
  { id: 7, noChemo: false, name: 'RN 7', locked: false },
  { id: 8, noChemo: false, name: 'RN 8', locked: false },
  { id: 9, noChemo: false, name: 'RN 9', locked: false },
  { id: 10, noChemo: false, name: 'RN 10', locked: false },
];

const generateInitialRooms = () => {
  const rooms = Array.from({ length: 30 }, (_, i) => ({
    room: i + 1,
    tx: `Pt ${i + 1}`,
    acuity: 2,
    admit: false,
    imc: false,
    cna: false,
    chemo: false,
    notIndep: false,
    rn: '-',
    locked: false
  }));

  // Add Room H (empty by default)
  rooms.push({
    room: 'H',
    tx: '',
    acuity: 2,
    admit: false,
    imc: false,
    cna: false,
    chemo: false,
    notIndep: false,
    rn: '-',
    locked: false
  });

  return rooms;
};

const initialRooms = generateInitialRooms();

// Remix default diagnoses
const mockDiagnoses = ['Chemo', 'Auto', 'Allo', 'CART'];

// Pure helper – moved to module scope so it isn't recreated on every render
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Pure helper – moved to module scope so it isn't recreated on every render
const getRoomCoordinates = (roomNum) => {
  if (roomNum === 'H') return { x: 300, y: 30, rotation: 0, width: 70, height: 40 };
  const num = parseInt(roomNum, 10);
  const rightWallX = 360, leftWallX = 240, startY = 80, gapY = 50;

  if (num >= 7 && num <= 14) {
    const idx = 14 - num;
    return { x: rightWallX, y: startY + idx * gapY, rotation: 0, width: 70, height: 40 };
  }

  if (num >= 1 && num <= 6) {
    const idx = 6 - num;
    const startYAngled = 495;
    const startX = rightWallX;
    return { x: startX + (idx * 25), y: startYAngled + (idx * 43), rotation: -30, width: 70, height: 40 };
  }

  if (num >= 15 && num <= 23) {
    const idx = num - 15;
    return { x: leftWallX, y: startY + idx * gapY, rotation: 0, width: 70, height: 40 };
  }

  if (num >= 24 && num <= 30) {
    const idx = num - 24;
    const startYAngled = 545;
    const startX = leftWallX;
    return { x: startX + (idx * 25), y: startYAngled + (idx * 43), rotation: -30, width: 70, height: 40 };
  }

  return { x: 0, y: 0, rotation: 0, width: 70, height: 40 };
};

const NURSE_COLORS = [
  { fill: '#dbeafe', stroke: '#3b82f6', text: '#1d4ed8' },
  { fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' },
  { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  { fill: '#fce7f3', stroke: '#db2777', text: '#9d174d' },
  { fill: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' },
  { fill: '#e0f2fe', stroke: '#0284c7', text: '#075985' },
  { fill: '#fff7ed', stroke: '#ea580c', text: '#9a3412' },
  { fill: '#f0fdf4', stroke: '#15803d', text: '#14532d' },
  { fill: '#fdf4ff', stroke: '#c026d3', text: '#86198f' },
  { fill: '#fefce8', stroke: '#ca8a04', text: '#713f12' },
];

const ACUITY_COLOR = { 1: '#94a3b8', 2: '#94a3b8', 3: '#f59e0b', 4: '#ef4444' };

// Defined outside App so React doesn't unmount/remount it on every parent render
function UnitMap({ rooms, nurses, hoveredNurse }) {
  const nurseColorMap = {};
  nurses.filter(n => n.name?.trim()).forEach((nurse, i) => {
    nurseColorMap[nurse.name] = NURSE_COLORS[i % NURSE_COLORS.length];
  });

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 flex justify-center overflow-hidden">
      <svg width="100%" height="560" viewBox="0 0 600 920" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="room-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#00000018" />
          </filter>
        </defs>

        {/* Corridor — outer wall, inner floor */}
        <path d="M 300,50 L 300,450 L 500,800" stroke="#cbd5e1" strokeWidth="98" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 300,50 L 300,450 L 500,800" stroke="#f1f5f9" strokeWidth="90" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Center dashes on straight section */}
        <path d="M 300,55 L 300,448" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="10,9" fill="none" />

        {rooms.map((room) => {
          const { x, y, rotation, width, height } = getRoomCoordinates(room.room);
          const hasRn = room.rn && room.rn !== '-';
          const isHovered = hoveredNurse && room.rn === hoveredNurse;
          const nurseColor = hasRn ? nurseColorMap[room.rn] : null;
          const isFilled = room.tx && room.tx.trim() !== '';
          const acuity = Number(room.acuity);

          let fillColor = '#f1f5f9';
          let strokeColor = '#e2e8f0';
          let strokeWidth = 1.5;
          let textColor = '#94a3b8';

          if (isFilled) {
            if (nurseColor) {
              fillColor = isHovered ? nurseColor.fill : nurseColor.fill + 'cc';
              strokeColor = isHovered ? nurseColor.stroke : nurseColor.stroke + '99';
              strokeWidth = isHovered ? 2.5 : 1.5;
              textColor = nurseColor.text;
            } else {
              fillColor = '#ffffff';
              strokeColor = '#94a3b8';
              textColor = '#475569';
            }
          }

          const displayName = hasRn && isFilled
            ? (room.rn.length > 7 ? room.rn.substring(0, 6) + '.' : room.rn)
            : '';

          const flags = [];
          if (isFilled && room.admit) flags.push('#22c55e');
          if (isFilled && room.chemo) flags.push('#ef4444');
          if (isFilled && room.imc) flags.push('#8b5cf6');

          return (
            <g
              key={room.room}
              transform={`translate(${x}, ${y}) rotate(${rotation})`}
              style={{ filter: isFilled ? 'url(#room-shadow)' : 'none' }}
            >
              <rect
                x={-width / 2} y={-height / 2}
                width={width} height={height}
                rx="5" ry="5"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />

              {/* Room number */}
              <text
                x="0" y={displayName ? '-3' : '5'}
                textAnchor="middle"
                fontSize={room.room === 'H' ? '14' : '12'}
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill={textColor}
              >
                {room.room}
              </text>

              {/* RN name */}
              {displayName && (
                <text
                  x="0" y="10"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill={textColor}
                  opacity="0.85"
                >
                  {displayName}
                </text>
              )}

              {/* Acuity badge — top-right */}
              {isFilled && acuity > 0 && (
                <g transform={`translate(${width / 2 - 8}, ${-height / 2 + 8})`}>
                  <circle r="7" fill={ACUITY_COLOR[acuity] || '#94a3b8'} />
                  <text
                    x="0" y="3.5"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fill="white"
                  >
                    {acuity}
                  </text>
                </g>
              )}

              {/* Flag dots — bottom-left (admit=green, chemo=red, imc=purple) */}
              {flags.length > 0 && (
                <g transform={`translate(${-width / 2 + 5}, ${height / 2 - 7})`}>
                  {flags.map((color, i) => (
                    <circle key={i} cx={i * 9} cy="0" r="4" fill={color} />
                  ))}
                </g>
              )}

              {/* Lock dot — bottom-right */}
              {room.locked && (
                <circle
                  cx={width / 2 - 6}
                  cy={height / 2 - 6}
                  r="4"
                  fill="#7c3aed"
                  opacity="0.7"
                />
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(20, 870)" fontFamily="system-ui, -apple-system, sans-serif">
          <circle cx="5" cy="0" r="4.5" fill="#22c55e" />
          <text x="14" y="4" fontSize="11" fill="#64748b">Admit</text>
          <circle cx="58" cy="0" r="4.5" fill="#ef4444" />
          <text x="67" y="4" fontSize="11" fill="#64748b">Chemo</text>
          <circle cx="118" cy="0" r="4.5" fill="#8b5cf6" />
          <text x="127" y="4" fontSize="11" fill="#64748b">IMC</text>
          <circle cx="158" cy="0" r="4.5" fill="#f59e0b" />
          <text x="167" y="4" fontSize="11" fill="#64748b">Acuity 3</text>
          <circle cx="220" cy="0" r="4.5" fill="#ef4444" />
          <text x="229" y="4" fontSize="11" fill="#64748b">Acuity 4</text>
        </g>
      </svg>
    </div>
  );
}

export default function App() {
  const [nurses, setNurses] = useState(initialNurses);
  const [rooms, setRooms] = useState(initialRooms);
  const [localInputs, setLocalInputs] = useState({});
  const [editingRooms, setEditingRooms] = useState(null);
  const [rationale, setRationale] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [newNurseName, setNewNurseName] = useState('');
  const [isClearingAssignments, setIsClearingAssignments] = useState(false);
  const [hoveredNurse, setHoveredNurse] = useState(null);

  // Refs for confirm-action timeouts so they can be cleaned up on unmount
  const clearingTimerRef = useRef(null);
  const clearingAssignmentsTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(clearingTimerRef.current);
      clearTimeout(clearingAssignmentsTimerRef.current);
    };
  }, []);

  // Remix Modal State
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [remixCounts, setRemixCounts] = useState({
    acuity4: 4,
    acuity3: 10,
    admits: 3,
    chemo: 5,
    notIndep: 5
  });

  const nurseStats = useMemo(() => {
    const stats = {};
    nurses.forEach(nurse => {
      if (nurse.name) {
        stats[nurse.name] = { rooms: [], acuity: 0, hasChemo: false, imcs: 0, admits: 0, acuity4Count: 0 };
      }
    });

    rooms.forEach(room => {
      if (room.rn && room.rn !== '-' && stats[room.rn]) {
        stats[room.rn].rooms.push({
          id: room.room,
          admit: room.admit,
          chemo: room.chemo,
          imc: room.imc,
          acuity: Number(room.acuity) || 0,
          cna: room.cna,
          notIndep: room.notIndep
        });
        stats[room.rn].acuity += Number(room.acuity) || 0;

        if (room.chemo) stats[room.rn].hasChemo = true;
        if (room.imc) stats[room.rn].imcs += 1;
        if (room.admit) stats[room.rn].admits += 1;
        if (Number(room.acuity) === 4) stats[room.rn].acuity4Count += 1;
      }
    });
    return stats;
  }, [rooms, nurses]);

  const summaryStats = useMemo(() => {
    const activeNursesCount = nurses.filter(n => n.name.trim() !== '').length;
    const stats = rooms.reduce((acc, room) => {
      const acuityVal = Number(room.acuity) || 0;
      const isFilled = room.tx && room.tx.trim() !== '';
      return {
        totalAcuity: acc.totalAcuity + (isFilled ? acuityVal : 0),
        acuity4Count: acc.acuity4Count + (isFilled && acuityVal === 4 ? 1 : 0),
        acuity3Count: acc.acuity3Count + (isFilled && acuityVal === 3 ? 1 : 0),
        census: acc.census + (isFilled ? 1 : 0),
        chemoCount: acc.chemoCount + (isFilled && room.chemo ? 1 : 0),
        imcCount: acc.imcCount + (isFilled && room.imc ? 1 : 0),
        admitsCount: acc.admitsCount + (isFilled && room.admit ? 1 : 0),
        cnaCount: acc.cnaCount + (isFilled && room.cna ? 1 : 0)
      };
    }, { totalAcuity: 0, acuity4Count: 0, acuity3Count: 0, census: 0, chemoCount: 0, imcCount: 0, admitsCount: 0, cnaCount: 0 });

    return { ...stats, activeNursesCount };
  }, [rooms, nurses]);

  const applyRemix = () => {
    const targetAdmits = parseInt(remixCounts.admits) || 0;
    const targetChemos = parseInt(remixCounts.chemo) || 0;
    const targetNotIndep = parseInt(remixCounts.notIndep) || 0;
    const targetL4s = parseInt(remixCounts.acuity4) || 0;
    const targetL3s = parseInt(remixCounts.acuity3) || 0;

    let nextRooms = rooms.map(room => {
      if (room.locked) return room;
      const isRoomH = room.room === 'H';
      const isFilled = isRoomH ? Math.random() > 0.5 : true;
      if (!isFilled) return { ...room, tx: '', acuity: 0, admit: false, imc: false, cna: false, chemo: false, notIndep: false, rn: '-' };
      return { ...room, tx: mockDiagnoses[Math.floor(Math.random() * mockDiagnoses.length)], acuity: 2, admit: false, imc: false, cna: false, chemo: false, notIndep: false, rn: '-' };
    });

    const filledIndices = nextRooms.map((r, i) => (!r.locked && r.tx !== '' ? i : null)).filter(val => val !== null);

    // Assign acuity levels – use a single shuffled array to avoid reassigning the same room twice
    const shuffledForAcuity = shuffleArray(filledIndices);
    shuffledForAcuity.slice(0, targetL4s).forEach(idx => {
      nextRooms[idx] = { ...nextRooms[idx], acuity: 4 };
    });
    shuffledForAcuity.slice(targetL4s, targetL4s + targetL3s).forEach(idx => {
      nextRooms[idx] = { ...nextRooms[idx], acuity: 3 };
    });

    // Assign IMC based on acuity – immutable map instead of in-place mutation
    nextRooms = nextRooms.map(room => {
      if (room.locked || room.tx === '') return room;
      const ac = Number(room.acuity);
      const imc = ac === 4 ? true : ac === 3 ? Math.random() > 0.5 : false;
      return { ...room, imc };
    });

    // Assign boolean flags immutably
    shuffleArray(filledIndices).slice(0, targetAdmits).forEach(idx => {
      nextRooms[idx] = { ...nextRooms[idx], admit: true };
    });
    shuffleArray(filledIndices).slice(0, targetChemos).forEach(idx => {
      nextRooms[idx] = { ...nextRooms[idx], chemo: true };
    });
    shuffleArray(filledIndices).slice(0, targetNotIndep).forEach(idx => {
      nextRooms[idx] = { ...nextRooms[idx], notIndep: true };
    });

    setRooms(nextRooms);
    setRationale(null);
    setShowRemixModal(false);
  };

  const autoAssignCNAs = () => {
    const newRooms = rooms.map(room => {
      if (room.locked) return room;                            // Bug fix: respect room lock
      const isFilled = room.tx && room.tx.trim() !== '';
      if (!isFilled) return room;                              // Bug fix: skip empty rooms
      const isAcuity4 = Number(room.acuity) === 4;
      const isAdmit = room.admit;
      const isRoomH = room.room === 'H';
      const isNotIndep = room.notIndep;
      if (isAcuity4 || isAdmit || isRoomH || isNotIndep) {
        return { ...room, cna: true };
      }
      return room;
    });
    setRooms(newRooms);
    setRationale("CNAs automatically assigned to all Acuity 4 patients, Admissions, Not Independent patients, and Room H (if occupied).");
  };

  const clearRooms = () => {
    if (isClearing) {
      const newRooms = rooms.map(room => {
        if (room.locked) return room;
        const defaultTx = room.room === 'H' ? '' : `Pt ${room.room}`;
        return { ...room, tx: defaultTx, acuity: 2, admit: false, imc: false, cna: false, chemo: false, notIndep: false, rn: '-' };
      });
      setRooms(newRooms);
      setRationale("All unlocked rooms reset to default state (Pt #, Acuity 2).");
      setIsClearing(false);
    } else {
      setIsClearing(true);
      clearTimeout(clearingTimerRef.current);
      clearingTimerRef.current = setTimeout(() => setIsClearing(false), 3000);
    }
  };

  const clearAssignments = () => {
    if (isClearingAssignments) {
      const newRooms = rooms.map(room => {
        if (room.locked) return room;
        const nurse = nurses.find(n => n.name === room.rn);
        if (nurse && nurse.locked) return room;
        return { ...room, rn: '-' };
      });
      setRooms(newRooms);
      setRationale("Assignments cleared (locked assignments preserved).");
      setIsClearingAssignments(false);
    } else {
      setIsClearingAssignments(true);
      clearTimeout(clearingAssignmentsTimerRef.current);
      clearingAssignmentsTimerRef.current = setTimeout(() => setIsClearingAssignments(false), 3000);
    }
  };

  const autoAssign = () => {
    const activeNurses = nurses.filter(n => n.name.trim() !== '');
    if (activeNurses.length === 0) return;

    const nurseLoads = {};
    activeNurses.forEach(n => {
      nurseLoads[n.name] = {
        name: n.name, acuity: 0, patients: 0, admits: 0, imcs: 0,
        acuity4Count: 0, hasAcuityGreaterThan2: false,
        isChemoCert: !n.noChemo, isLocked: n.locked
      };
    });

    let lockedCount = 0;
    const effectivelyLockedRoomIds = new Set();
    rooms.forEach(r => {
      if (r.locked) effectivelyLockedRoomIds.add(r.room);
      else {
        const assignedNurse = nurses.find(n => n.name === r.rn);
        if (assignedNurse && assignedNurse.locked) effectivelyLockedRoomIds.add(r.room);
      }
    });

    rooms.forEach(room => {
      if (effectivelyLockedRoomIds.has(room.room) && room.rn && room.rn !== '-' && nurseLoads[room.rn]) {
        const n = nurseLoads[room.rn];
        const roomAcuity = Number(room.acuity) || 0;
        n.patients += 1;
        n.acuity += roomAcuity;
        if (room.admit) n.admits += 1;
        if (room.imc) n.imcs += 1;
        if (roomAcuity > 2) n.hasAcuityGreaterThan2 = true;
        if (roomAcuity === 4) n.acuity4Count += 1;
        lockedCount++;
      }
    });

    const sortedRooms = [...rooms].sort((a, b) => {
      let scoreA = Number(a.acuity || 0);
      if (a.chemo) scoreA += 100;
      if (a.imc) scoreA += 50;
      if (a.admit) scoreA += 25;
      let scoreB = Number(b.acuity || 0);
      if (b.chemo) scoreB += 100;
      if (b.imc) scoreB += 50;
      if (b.admit) scoreB += 25;
      return scoreB - scoreA;
    });

    const activeRooms = sortedRooms.filter(r => r.tx && r.tx.trim() !== '' && !effectivelyLockedRoomIds.has(r.room));
    const assignments = {};
    let unassignedRooms = [];
    let placedChemo = 0, placedAdmits = 0, placedAcuity4 = 0;

    const getNurseLoadScore = (nurse, roomAcuity, isAdmit) => {
      let score = (nurse.patients * 3.5) + nurse.acuity;
      if (nurse.acuity + roomAcuity >= 10) score += 100;
      if ((nurse.acuity4Count > 0 && isAdmit) || (nurse.admits > 0 && roomAcuity === 4)) score += 50;
      if (nurse.patients === 3 && (nurse.admits > 0 || isAdmit)) score += 25;
      if (nurse.patients === 3 && (roomAcuity > 2 || nurse.hasAcuityGreaterThan2)) score += 20;
      return score;
    };

    activeRooms.forEach(room => {
      const roomAcuity = Number(room.acuity || 0);
      const isAdmit = room.admit, isChemo = room.chemo, isImc = room.imc;
      let eligible = Object.values(nurseLoads).filter(n => {
        if (n.isLocked || n.patients >= 4) return false;
        if (isChemo && !n.isChemoCert) return false;
        if (isAdmit && n.admits >= 1) return false;
        if (isImc && n.patients >= 3) return false;
        if (n.imcs > 0 && n.patients >= 3) return false;
        if (roomAcuity === 4 && (n.acuity4Count >= 1 || n.patients >= 3)) return false;
        if (n.acuity4Count > 0 && n.patients >= 3) return false;
        return true;
      });

      eligible.sort((a, b) => getNurseLoadScore(a, roomAcuity, isAdmit) - getNurseLoadScore(b, roomAcuity, isAdmit));

      if (eligible.length > 0) {
        const chosenNurse = eligible[0];
        assignments[room.room] = chosenNurse.name;
        chosenNurse.acuity += roomAcuity;
        chosenNurse.patients += 1;
        if (isAdmit) { chosenNurse.admits += 1; placedAdmits++; }
        if (isImc) chosenNurse.imcs += 1;
        if (isChemo) placedChemo++;
        if (roomAcuity > 2) chosenNurse.hasAcuityGreaterThan2 = true;
        if (roomAcuity === 4) { chosenNurse.acuity4Count += 1; placedAcuity4++; }
      } else {
        assignments[room.room] = '-';
        let traits = [];
        if (roomAcuity === 4) traits.push("Acuity 4");
        if (isChemo) traits.push("Chemo");
        if (isImc) traits.push("IMC");
        if (isAdmit) traits.push("Admit");
        unassignedRooms.push({ id: room.room, reason: traits.join(', ') || `Acuity ${roomAcuity}` });
      }
    });

    const newRooms = rooms.map(r => {
      if (effectivelyLockedRoomIds.has(r.room)) return r;
      return { ...r, rn: (r.tx && r.tx.trim() !== '') ? (assignments[r.room] || '-') : '-' };
    });
    setRooms(newRooms);
    setRationale({
      stats: { locked: lockedCount, chemo: placedChemo, admits: placedAdmits, acuity4: placedAcuity4, assignedCount: Object.keys(assignments).length - unassignedRooms.length },
      unassigned: unassignedRooms
    });
  };

  const handleNurseRoomsChange = (nurseName, value) => {
    if (!nurseName) return;
    const roomIds = value.split(/[\s,]+/).filter(Boolean).map(id => id.toUpperCase());
    setRooms(prevRooms => prevRooms.map(room => {
      const isAssignedHere = roomIds.includes(String(room.room).toUpperCase());
      if (isAssignedHere) return { ...room, rn: nurseName };
      else if (room.rn === nurseName) return { ...room, rn: '-' };
      return room;
    }));
  };

  const updateRoom = (index, field, value) => {
    const newRooms = [...rooms];
    newRooms[index] = { ...newRooms[index], [field]: value };
    setRooms(newRooms);
  };

  const toggleLock = (index) => {
    const newRooms = [...rooms];
    newRooms[index] = { ...newRooms[index], locked: !newRooms[index].locked };
    setRooms(newRooms);
  };

  const updateNurse = (index, field, value) => {
    const newNurses = [...nurses];
    const oldName = newNurses[index].name;
    newNurses[index] = { ...newNurses[index], [field]: value };
    setNurses(newNurses);
    if (field === 'name' && oldName && value) {
      setRooms(rooms.map(room => room.rn === oldName ? { ...room, rn: value } : room));
    }
  };

  const addNurse = () => {
    const name = newNurseName.trim();
    if (!name) return;
    setNurses([...nurses, { id: Date.now(), noChemo: false, name, locked: false }]);
    setNewNurseName('');
  };

  const deleteNurse = (index) => {
    const nurse = nurses[index];
    setRooms(rooms.map(room => room.rn === nurse.name ? { ...room, rn: '-' } : room));
    setNurses(nurses.filter((_, i) => i !== index));
  };

  const toggleNurseLock = (index) => {
    const newNurses = [...nurses];
    newNurses[index] = { ...newNurses[index], locked: !newNurses[index].locked };
    setNurses(newNurses);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800 pb-20 relative">

      {/* Remix Modal */}
      {showRemixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <RefreshCw size={20} />
                Remix Patient Population
              </h3>
              <button onClick={() => setShowRemixModal(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">Set target counts for the randomizer (approximate):</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Acuity 4s</label>
                  <input type="number" min="0" max="30" className="w-full p-2 border rounded-md" value={remixCounts.acuity4} onChange={(e) => setRemixCounts({...remixCounts, acuity4: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Acuity 3s</label>
                  <input type="number" min="0" max="30" className="w-full p-2 border rounded-md" value={remixCounts.acuity3} onChange={(e) => setRemixCounts({...remixCounts, acuity3: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Admissions</label>
                  <input type="number" min="0" max="30" className="w-full p-2 border rounded-md" value={remixCounts.admits} onChange={(e) => setRemixCounts({...remixCounts, admits: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Chemo Pts</label>
                  <input type="number" min="0" max="30" className="w-full p-2 border rounded-md" value={remixCounts.chemo} onChange={(e) => setRemixCounts({...remixCounts, chemo: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Not Independent</label>
                  <input type="number" min="0" max="30" className="w-full p-2 border rounded-md" value={remixCounts.notIndep} onChange={(e) => setRemixCounts({...remixCounts, notIndep: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button onClick={() => setShowRemixModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={applyRemix} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Generate List</button>
            </div>
          </div>
        </div>
      )}

      {/* Header / Summary */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <div className="flex flex-col items-center justify-center p-3 bg-red-50 rounded-lg border border-red-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Nurses</span>
            <span className="text-3xl font-black text-red-900 leading-none">{summaryStats.activeNursesCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-orange-50 rounded-lg border border-orange-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Census</span>
            <span className="text-3xl font-black text-orange-900 leading-none">{summaryStats.census}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-amber-50 rounded-lg border border-amber-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Total Acuity</span>
            <span className="text-3xl font-black text-amber-900 leading-none">{summaryStats.totalAcuity}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-green-50 rounded-lg border border-green-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Acuity 4</span>
            <span className="text-3xl font-black text-green-900 leading-none">{summaryStats.acuity4Count}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-lime-50 rounded-lg border border-lime-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-lime-600 font-bold uppercase tracking-wider mb-1">Acuity 3</span>
            <span className="text-3xl font-black text-lime-900 leading-none">{summaryStats.acuity3Count}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-lg border border-blue-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">IMC</span>
            <span className="text-3xl font-black text-blue-900 leading-none">{summaryStats.imcCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-indigo-50 rounded-lg border border-indigo-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-1">Admits</span>
            <span className="text-3xl font-black text-indigo-900 leading-none">{summaryStats.admitsCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-fuchsia-600 font-bold uppercase tracking-wider mb-1">Chemo</span>
            <span className="text-3xl font-black text-fuchsia-900 leading-none">{summaryStats.chemoCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 bg-teal-50 rounded-lg border border-teal-100 min-w-[100px] flex-1 sm:flex-none">
            <span className="text-xs text-teal-600 font-bold uppercase tracking-wider mb-1">CNA Assigned</span>
            <span className="text-3xl font-black text-teal-900 leading-none">{summaryStats.cnaCount}</span>
          </div>
        </div>
      </header>

      {rationale && (
        <div className={`mb-6 border p-5 rounded-xl flex gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 ${rationale?.unassigned?.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
          <div className="shrink-0 mt-1">{rationale?.unassigned?.length > 0 ? <AlertTriangle className="text-amber-600" size={24} /> : <CheckCircle2 className="text-blue-600" size={24} />}</div>
          <div className="w-full">
            <h3 className={`font-bold mb-2 flex items-center gap-2 ${rationale?.unassigned?.length > 0 ? 'text-amber-800' : 'text-blue-800'}`}>Assignment Analysis</h3>
            {typeof rationale === 'object' && rationale.stats ? (
              <>
                <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed opacity-90 mb-3">
                  <li><strong>Success:</strong> Auto-assigned {rationale.stats.assignedCount} patients while preserving {rationale.stats.locked} locked assignments.</li>
                  <li><strong>Chemo Safety:</strong> Placed {rationale.stats.chemo} active Chemo patients with certified RNs.</li>
                  <li><strong>Critical Care:</strong> Safely distributed {rationale.stats.acuity4} Acuity 4 patients (Max 1 per RN, capped at 3 patients total).</li>
                  <li><strong>Admissions:</strong> Assigned {rationale.stats.admits} admits (Max 1 per RN).</li>
                </ul>
                {rationale.unassigned && rationale.unassigned.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-200/60">
                    <strong className="text-amber-800 flex items-center gap-2 text-sm mb-2"><Eraser size={14} /> Unassigned Patients (Strict Constraints Prevented Placement):</strong>
                    <div className="flex flex-wrap gap-2">{rationale.unassigned.map((r) => <span key={r.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-amber-200 text-amber-800 shadow-sm">Room {r.id}: {r.reason}</span>)}</div>
                    <p className="text-xs text-amber-700 mt-2 italic">Tip: Manually assign these patients to override strict safety rules if necessary.</p>
                  </div>
                )}
              </>
            ) : <p className="text-sm leading-relaxed">{String(rationale)}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
        <div className="w-full md:w-1/2 xl:w-5/12 flex flex-col gap-4 md:sticky md:top-4 z-20">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Users size={18} className="text-blue-600" />RN Assignment</h2>
              <div className="flex items-center gap-2">
                <button onClick={autoAssign} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-sm" title="Auto-Assign Patients"><Wand2 size={14} />Auto</button>
                <button onClick={clearAssignments} className={`p-1.5 rounded-md transition-colors border ${isClearingAssignments ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'}`} title={isClearingAssignments ? "Confirm Clear?" : "Clear All Unlocked Assignments"}><UserMinus size={18} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-2 w-8 text-center"></th>
                    <th className="px-2 py-2 w-16 text-center">No Chemo</th>
                    <th className="px-3 py-2">RN Name</th>
                    <th className="px-3 py-2">Assigned Rooms</th>
                    <th className="px-3 py-2 text-center">Total Acuity</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nurses.map((nurse, index) => {
                    const stats = nurseStats[nurse.name] || { rooms: [], acuity: 0, hasChemo: false, imcs: 0, admits: 0, acuity4Count: 0 };

                    const chemoWarning = nurse.noChemo && stats.hasChemo;
                    const patientCountWarning = stats.rooms.length > 4;
                    const admitWarning = stats.admits > 1;
                    const imcWarning = stats.imcs > 0 && stats.rooms.length > 3;
                    const acuity4Warning = stats.acuity4Count > 1;
                    const acuity4LoadWarning = stats.acuity4Count > 0 && stats.rooms.length > 3;
                    const hasCriticalWarning = chemoWarning || patientCountWarning || admitWarning || imcWarning || acuity4Warning || acuity4LoadWarning;

                    const admitLoadWarning = stats.admits > 0 && stats.rooms.length > 3;
                    const highAcuityWithFour = stats.rooms.length === 4 && stats.rooms.some(r => r.acuity > 2);
                    const acuity4WithAdmitWarning = stats.acuity4Count > 0 && stats.admits > 0;
                    const hasSoftWarning = (admitLoadWarning || highAcuityWithFour || acuity4WithAdmitWarning || stats.acuity >= 10) && !hasCriticalWarning;

                    let tooltipMsgs = [];
                    if (nurse.locked) tooltipMsgs.push("Assignment Locked");
                    if (chemoWarning) tooltipMsgs.push("Non-certified RN assigned to Chemo patient!");
                    if (patientCountWarning) tooltipMsgs.push("RN has more than 4 patients!");
                    if (admitWarning) tooltipMsgs.push("RN has more than 1 admit!");
                    if (imcWarning) tooltipMsgs.push("RN with IMC has more than 3 patients!");
                    if (acuity4Warning) tooltipMsgs.push("RN has more than 1 Acuity 4 patient!");
                    if (acuity4LoadWarning) tooltipMsgs.push("RN with Acuity 4 patient has more than 3 patients!");
                    if (admitLoadWarning) tooltipMsgs.push("Soft Limit: RN with an admit has 4 patients.");
                    if (highAcuityWithFour) tooltipMsgs.push("Soft Limit: RN has 4 patients, but not all are Acuity 2.");
                    if (acuity4WithAdmitWarning) tooltipMsgs.push("Soft Limit: Avoid combining Admit with Acuity 4.");

                    let rowClass = 'hover:bg-slate-50 transition-colors duration-150';
                    if (hasCriticalWarning) rowClass = 'bg-rose-50 hover:bg-rose-100';
                    else if (hasSoftWarning) rowClass = 'bg-amber-50 hover:bg-amber-100';
                    else if (nurse.locked) rowClass = 'bg-purple-50 hover:bg-purple-100';

                    const nameClass = hasCriticalWarning ? 'text-rose-700' : (hasSoftWarning ? 'text-amber-700' : (nurse.locked ? 'text-purple-700 font-semibold' : ''));
                    let acuityClass = 'text-slate-400';
                    if (stats.acuity >= 10) acuityClass = 'bg-rose-100 text-rose-700';
                    else if (stats.acuity >= 8) acuityClass = 'bg-amber-100 text-amber-700';
                    else if (stats.acuity >= 6) acuityClass = 'bg-emerald-100 text-emerald-700';
                    else if (stats.acuity > 0) acuityClass = 'bg-slate-100 text-slate-700';

                    return (
                      <tr key={nurse.id} className={rowClass} onMouseEnter={() => setHoveredNurse(nurse.name)} onMouseLeave={() => setHoveredNurse(null)}>
                        <td className="px-2 py-1 text-center"><button onClick={() => toggleNurseLock(index)} className={`p-1 rounded-md transition-colors ${nurse.locked ? 'text-purple-600' : 'text-slate-300 hover:text-slate-500'}`}>{nurse.locked ? <Lock size={14} /> : <Unlock size={14} />}</button></td>
                        <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer" checked={nurse.noChemo || false} onChange={(e) => updateNurse(index, 'noChemo', e.target.checked)} /></td>
                        <td className="px-2 py-1"><input type="text" className={`w-full p-1 border-none bg-transparent hover:bg-slate-100 rounded font-medium focus:ring-1 focus:ring-blue-500 ${nameClass}`} value={nurse.name} onChange={(e) => updateNurse(index, 'name', e.target.value)} placeholder="Name..." /></td>
                        <td className="px-2 py-1 cursor-pointer group" onClick={() => { if (nurse.name) setEditingRooms(nurse.id); }}>
                          {editingRooms === nurse.id ? (
                            <input
                              autoFocus
                              type="text"
                              className="w-full p-1 border border-blue-500 focus:ring-1 focus:ring-blue-500 rounded bg-white text-sm shadow-sm"
                              value={localInputs[nurse.id] !== undefined ? localInputs[nurse.id] : stats.rooms.map(r => r.id).join(', ')}
                              onChange={(e) => setLocalInputs(prev => ({ ...prev, [nurse.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                              onBlur={() => {
                                if (localInputs[nurse.id] !== undefined) {
                                  handleNurseRoomsChange(nurse.name, localInputs[nurse.id]);
                                  // Clean up stale entry to prevent it reappearing next edit
                                  setLocalInputs(prev => {
                                    const next = { ...prev };
                                    delete next[nurse.id];
                                    return next;
                                  });
                                }
                                setEditingRooms(null);
                              }}
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1 min-h-[1.75rem] items-center p-1 rounded group-hover:bg-slate-100 transition-colors">
                              {stats.rooms.length > 0 ? stats.rooms.map(r => (
                                <span key={r.id} className={`${r.cna ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'} px-1.5 py-0.5 rounded border inline-flex items-baseline gap-0.5`} title={tooltipMsgs.join(' | ')}>
                                  {(r.admit || r.chemo || r.imc) && <span className="font-bold text-[9px] relative -top-1.5 flex gap-0.5">{r.admit && <span className="text-green-600">a</span>}{r.chemo && <span className="text-rose-600">c</span>}{r.imc && <span className="text-purple-600">i</span>}</span>}
                                  <span className="font-semibold text-sm leading-none">{r.id}</span>
                                  <span className="font-bold text-[9px] text-slate-500 relative -top-1.5">{r.acuity}</span>
                                </span>
                              )) : <span className="text-slate-400 italic text-xs">{nurse.name ? "Click to assign" : "None"}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold"><span className={`inline-block px-2 py-1 rounded-md min-w-[2rem] ${acuityClass} ${hasCriticalWarning || hasSoftWarning ? 'cursor-help' : ''}`} title={hasCriticalWarning || hasSoftWarning ? tooltipMsgs.filter(m => m !== "Assignment Locked").join('\n') : undefined}>{stats.acuity}</span></td>
                        <td className="px-2 py-1 text-center">
                          <button onClick={() => deleteNurse(index)} className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="Remove Nurse"><X size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={6} className="px-3 py-2">
                      <input
                        type="text"
                        className="w-full bg-transparent text-sm placeholder-slate-400 focus:outline-none"
                        placeholder="+ Add a nurse..."
                        value={newNurseName}
                        onChange={(e) => setNewNurseName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addNurse()}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 xl:w-7/12 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200"><h2 className="font-semibold text-slate-800 flex items-center gap-2"><MapIcon size={18} className="text-blue-600" />Unit Map</h2></div>
            <UnitMap rooms={rooms} nurses={nurses} hoveredNurse={hoveredNurse} />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2"><BedDouble size={18} className="text-blue-600" />Patient List</h2>
              <div className="flex items-center gap-2">
                <button onClick={autoAssignCNAs} className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-teal-200"><UserCheck size={14} />Auto CNA</button>
                <button onClick={() => setShowRemixModal(true)} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-indigo-200"><RefreshCw size={14} />Remix</button>
                <button onClick={clearRooms} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${isClearing ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300'}`}>{isClearing ? <AlertTriangle size={14} /> : <Eraser size={14} />}{isClearing ? "Confirm" : "Reset to Defaults"}</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 w-16 text-center">Room</th>
                    <th className="px-3 py-3 w-32">Tx / Diagnosis</th>
                    <th className="px-3 py-3 w-20 text-center">Acuity</th>
                    <th className="px-3 py-3 w-16 text-center">IMC</th>
                    <th className="px-2 py-3 w-16 text-center">Admit</th>
                    <th className="px-3 py-3 w-16 text-center">Chemo</th>
                    <th className="px-3 py-3 w-16 text-center">Not Indep</th>
                    <th className="px-3 py-3 w-16 text-center">CNA</th>
                    <th className="px-3 py-3 w-32">Assigned RN</th>
                    <th className="px-2 py-3 w-10 text-center">Lock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room, index) => (
                    <tr key={room.room} className={`hover:bg-slate-50 ${room.rn !== '-' ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-3 py-1 text-center font-medium text-slate-700">{room.room}</td>
                      <td className="px-2 py-1"><input type="text" className="w-full p-1.5 border border-transparent hover:border-slate-300 rounded bg-transparent focus:ring-1 focus:ring-blue-500" value={room.tx} onChange={(e) => updateRoom(index, 'tx', e.target.value)} placeholder="Empty room..." /></td>
                      <td className="px-2 py-1"><input type="number" min="1" max="4" className="w-full p-1.5 text-center border border-transparent hover:border-slate-300 rounded bg-transparent font-semibold focus:ring-1 focus:ring-blue-500" value={room.acuity || ''} onChange={(e) => updateRoom(index, 'acuity', e.target.value)} /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-purple-600 rounded border-slate-300 cursor-pointer" checked={room.imc || false} onChange={(e) => updateRoom(index, 'imc', e.target.checked)} /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-green-600 rounded border-slate-300 cursor-pointer" checked={room.admit || false} onChange={(e) => updateRoom(index, 'admit', e.target.checked)} /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-rose-600 rounded border-slate-300 cursor-pointer" checked={room.chemo || false} onChange={(e) => updateRoom(index, 'chemo', e.target.checked)} /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-orange-600 rounded border-slate-300 cursor-pointer" checked={room.notIndep || false} onChange={(e) => updateRoom(index, 'notIndep', e.target.checked)} /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer" checked={room.cna || false} onChange={(e) => updateRoom(index, 'cna', e.target.checked)} /></td>
                      <td className="px-2 py-1">
                        <select className={`w-full p-1.5 border rounded-md text-sm font-medium ${room.locked ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200'}`} value={room.rn} onChange={(e) => updateRoom(index, 'rn', e.target.value)}>
                          <option value="-">- Unassigned -</option>
                          {nurses.filter(n => n.name.trim() !== '').map(nurse => <option key={nurse.id} value={nurse.name}>{nurse.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-center"><button onClick={() => toggleLock(index)} className={`p-1.5 rounded-md transition-colors ${room.locked ? 'text-purple-600 bg-purple-100' : 'text-slate-400 hover:bg-slate-100'}`}>{room.locked ? <Lock size={14} /> : <Unlock size={14} />}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <ListChecks size={20} className="text-slate-500" />
          Assignment Parameters & Guidelines
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm text-slate-600">
          <div>
            <h4 className="font-bold text-rose-700 flex items-center gap-2 mb-3 uppercase text-xs tracking-wider"><Lock size={14} /> Hard Rules (Strict Limits)</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Max 4 Patients:</strong> No nurse will ever be assigned more than 4 patients.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Acuity 4 Cap:</strong> Any nurse assigned an Acuity 4 patient is strictly limited to <strong className="text-rose-700">3 patients maximum</strong>.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">IMC Cap:</strong> Any nurse assigned an IMC patient is strictly limited to <strong className="text-rose-700">3 patients maximum</strong>.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Single High Acuity:</strong> No nurse will be assigned more than <strong className="text-rose-700">one</strong> Acuity 4 patient.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Admit Limit:</strong> No nurse will be assigned more than 1 admission.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Chemo Safety:</strong> Nurses with "No Chemo" checked are strictly excluded from active chemo patients.</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-amber-600 flex items-center gap-2 mb-3 uppercase text-xs tracking-wider"><Wand2 size={14} /> Soft Rules (Optimization Goals)</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">High Acuity & Admits:</strong> Avoid assigning an admission to a nurse who is caring for an Acuity 4 patient.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Heavy Load Balancing:</strong> Avoid total acuity scores of 10+ and 4th patients on nurses with admissions.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Acuity Distribution:</strong> If a nurse has 4 patients, the system attempts to ensure all patients are Acuity 2 or lower.</span></li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span><span><strong className="text-slate-800">Priority Placement:</strong> Hard-to-place patients (Chemo, High Acuity, IMC) are assigned first.</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100 text-xs">
          <strong className="text-slate-700 block mb-2">Visual Indicator Legend:</strong>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-500">
            <span className="flex items-center gap-1">Admit <span className="font-bold text-[10px] text-green-600 bg-blue-100 px-1 rounded -mt-1">a</span></span>
            <span className="flex items-center gap-1">Chemo <span className="font-bold text-[10px] text-rose-600 bg-blue-100 px-1 rounded -mt-1">c</span></span>
            <span className="flex items-center gap-1">IMC <span className="font-bold text-[10px] text-purple-600 bg-blue-100 px-1 rounded -mt-1">i</span></span>
            <span className="flex items-center gap-1">Acuity <span className="font-bold text-[9px] text-slate-500 bg-blue-100 px-1 rounded -mt-1 ml-0.5">2</span></span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-rose-50 border border-rose-200 inline-block rounded-sm"></span> Rule Violation</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-50 border border-amber-200 inline-block rounded-sm"></span> Soft Limit Warning</span>
          </div>
        </div>
      </div>
      <footer className="mt-6 text-center text-xs text-slate-400">
        v{__BUILD_DATE__} &middot; {__COMMIT_HASH__}
      </footer>
      <Analytics />
    </div>
  );
}
