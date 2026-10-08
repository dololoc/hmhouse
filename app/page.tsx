'use client';

import { useEffect, useRef, useState } from 'react';

type GhostColor = 'black' | 'purple' | 'white';
type View = 'board' | 'home' | 'collection';
type BoardItem = { id: number; color: GhostColor; level: number };
type GameState = {
  started: boolean;
  board: (BoardItem | null)[];
  energy: number;
  stars: number;
  ghosts: Record<GhostColor, number>;
  decor: Record<GhostColor, number>;
  rewards: BoardItem[];
  lastEnergyAt: number;
  lastDaily: string;
  dailyStep: number;
  nextId: number;
  endingSeen: boolean;
  musicOn: boolean;
  volume: number;
};

const STORAGE_KEY = 'heumul-house-save-v1';
const COLORS: GhostColor[] = ['black', 'purple', 'white'];
const COLOR_INFO = {
  black: { name: '검은', ghost: '먹구', need: 8, maxLevel: 3, chance: 50, image: '/meokgu-v2.png', roomImage: '/room-black.png', room: '작은 침실', quote: '조금 무섭지만… 같이 있으면 괜찮아.' },
  purple: { name: '보라', ghost: '몽글', need: 16, maxLevel: 4, chance: 30, image: '/mongle-v2.png', roomImage: '/room-purple.png', room: '꿈의 서재', quote: '아주 긴 꿈을 꾼 것 같아.' },
  white: { name: '하얀', ghost: '설기', need: 32, maxLevel: 5, chance: 20, image: '/seolgi-v2.png', roomImage: '/room-white.png', room: '달빛 다락방', quote: '이 집이 우리를 기다리고 있었어.' },
} as const;
const DECOR = {
  black: ['별빛 스탠드', '폭신한 이불', '달무늬 커튼'],
  purple: ['꿈 유리병', '낡은 흔들의자', '초승달 책장'],
  white: ['가족사진', '하얀 찻잔', '달빛 망원경'],
} as const;
const DECOR_COSTS = [5, 10, 15];
const ROOM_CAPS = [3, 5, 8, 12];

const emptyState = (): GameState => ({
  started: false,
  board: Array(35).fill(null),
  energy: 20,
  stars: 10,
  ghosts: { black: 0, purple: 0, white: 0 },
  decor: { black: 0, purple: 0, white: 0 },
  rewards: [],
  lastEnergyAt: Date.now(),
  lastDaily: '',
  dailyStep: 0,
  nextId: 1,
  endingSeen: false,
  musicOn: true,
  volume: 0.35,
});

const dateKey = (date = new Date()) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const yesterdayKey = () => { const day = new Date(); day.setDate(day.getDate() - 1); return dateKey(day); };

export default function Home() {
  const [game, setGame] = useState<GameState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>('board');
  const [settings, setSettings] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [completed, setCompleted] = useState<GhostColor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as GameState;
        const elapsed = Math.max(0, Date.now() - saved.lastEnergyAt);
        const gained = Math.floor(elapsed / 180000);
        saved.energy = Math.min(20, saved.energy + gained);
        saved.lastEnergyAt = gained > 0 ? saved.lastEnergyAt + gained * 180000 : saved.lastEnergyAt;
        const compactBoard = saved.board.filter((item): item is BoardItem => Boolean(item)).slice(0, 35);
        setGame({ ...emptyState(), ...saved, board: [...compactBoard, ...Array(35).fill(null)].slice(0, 35) });
      } catch { setGame(emptyState()); }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      setGame(current => {
        if (current.energy >= 20) return { ...current, lastEnergyAt: Date.now() };
        if (Date.now() - current.lastEnergyAt < 180000) return current;
        const gained = Math.floor((Date.now() - current.lastEnergyAt) / 180000);
        return { ...current, energy: Math.min(20, current.energy + gained), lastEnergyAt: current.lastEnergyAt + gained * 180000 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!completed || !game.musicOn || !audioRef.current) return;
    const { ctx } = audioRef.current;
    [293.66, 369.99, 440, 587.33].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * .22;
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, game.volume * .08), start + .05);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .75);
      osc.connect(gain).connect(ctx.destination); osc.start(start); osc.stop(start + .8);
    });
  }, [completed, game.musicOn, game.volume]);

  useEffect(() => {
    if (!hydrated || !game.musicOn || !game.started) {
      if (audioRef.current) {
        clearInterval(audioRef.current.timer);
        audioRef.current.ctx.close();
        audioRef.current = null;
      }
      return;
    }
    const startMusic = () => {
      if (audioRef.current) return;
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtor();
      const notes = [220, 261.63, 293.66, 246.94];
      let step = 0;
      const play = () => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = notes[step++ % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(game.volume * 0.035, ctx.currentTime + .08); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + 2.8);
        osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 2.9);
      };
      play();
      audioRef.current = { ctx, timer: setInterval(play, 3300) };
    };
    window.addEventListener('pointerdown', startMusic, { once: true });
    return () => window.removeEventListener('pointerdown', startMusic);
  }, [game.musicOn, game.started, game.volume, hydrated]);

  const track = (event: string, data: Record<string, unknown> = {}) => {
    const win = window as typeof window & { dataLayer?: unknown[] };
    win.dataLayer?.push({ event, ...data });
  };

  const patchGame = (patch: Partial<GameState>) => setGame(current => ({ ...current, ...patch }));

  const startGame = () => {
    patchGame({ started: true });
    track('game_start');
  };

  const generate = () => {
    const free = game.board.findIndex(item => item === null);
    if (game.energy <= 0) return setToast('에너지가 다시 차오르길 기다려주세요');
    if (free < 0) return setToast('보드가 가득 찼어요. 반죽을 버려 자리를 만들어주세요');
    const roll = Math.random() * 100;
    const color: GhostColor = roll < 50 ? 'black' : roll < 80 ? 'purple' : 'white';
    const board = [...game.board];
    board[free] = { id: game.nextId, color, level: 0 };
    setGame({ ...game, board, energy: game.energy - 1, nextId: game.nextId + 1, lastEnergyAt: game.energy === 20 ? Date.now() : game.lastEnergyAt });
    track('generator_use', { color });
  };

  const moveOrMerge = (from: number, to: number) => {
    if (from === to) return;
    const source = game.board[from];
    if (!source) return;
    const target = game.board[to];
    const board = [...game.board];
    if (!target) {
      board[to] = source; board[from] = null;
      return patchGame({ board });
    }
    if (target.color !== source.color || target.level !== source.level) return setToast('같은 색과 같은 모양끼리 합칠 수 있어요');
    const nextLevel = source.level + 1;
    const info = COLOR_INFO[source.color];
    board[from] = null;
    if (nextLevel >= info.maxLevel) {
      board[to] = null;
      const previous = game.ghosts[source.color];
      const ghosts = { ...game.ghosts, [source.color]: previous + 1 };
      setGame({ ...game, board, ghosts, energy: Math.min(20, game.energy + 5), stars: game.stars + (previous === 0 ? 21 : 6) });
      setCompleted(source.color);
      track('ghost_complete', { color: source.color, repeat: previous > 0 });
    } else {
      board[to] = { ...target, level: nextLevel };
      setGame({ ...game, board, stars: game.stars + 1 });
      track('merge_success', { color: source.color, level: nextLevel });
    }
  };

  const onPointerDown = (index: number, event: React.PointerEvent) => {
    if (!game.board[index]) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: index, x: event.clientX, y: event.clientY });
  };
  const onPointerMove = (event: React.PointerEvent) => drag && setDrag({ ...drag, x: event.clientX, y: event.clientY });
  const onPointerUp = (event: React.PointerEvent) => {
    if (!drag) return;
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const trash = element?.closest('[data-trash]');
    const cell = element?.closest('[data-index]') as HTMLElement | null;
    if (trash) setConfirmDelete(drag.from);
    else if (cell) moveOrMerge(drag.from, Number(cell.dataset.index));
    setDrag(null);
  };

  const deleteItem = () => {
    if (confirmDelete === null) return;
    const board = [...game.board]; board[confirmDelete] = null;
    patchGame({ board }); setConfirmDelete(null); track('item_discard');
  };

  const dailyStatus = () => {
    if (game.lastDaily === dateKey()) return { available: false, step: game.dailyStep || 1 };
    const step = game.lastDaily === yesterdayKey() ? (game.dailyStep % 3) + 1 : 1;
    return { available: true, step };
  };

  const claimDaily = () => {
    const status = dailyStatus();
    if (!status.available) return setToast('오늘의 선물은 이미 받았어요');
    const color = COLORS[status.step - 1];
    const rewards = [...game.rewards, { id: game.nextId, color, level: 0 }, { id: game.nextId + 1, color, level: 0 }];
    setGame({ ...game, rewards, nextId: game.nextId + 2, lastDaily: dateKey(), dailyStep: status.step });
    setDailyOpen(false); setToast(`${COLOR_INFO[color].name} 반죽 2개가 보상함에 도착했어요`); track('daily_claim', { day: status.step });
  };

  const receiveReward = () => {
    if (!game.rewards.length) return;
    const free = game.board.findIndex(item => item === null);
    if (free < 0) return setToast('보드에 빈칸이 필요해요');
    const [reward, ...rewards] = game.rewards;
    const board = [...game.board]; board[free] = reward;
    patchGame({ board, rewards });
  };

  const buyDecor = (color: GhostColor) => {
    const level = game.decor[color];
    if (!game.ghosts[color]) return setToast('먼저 이 방의 유령을 찾아주세요');
    if (level >= 3) return;
    const cost = DECOR_COSTS[level];
    if (game.stars < cost) return setToast(`별조각이 ${cost - game.stars}개 부족해요`);
    const decor = { ...game.decor, [color]: level + 1 };
    const ending = COLORS.every(c => game.ghosts[c] > 0 && decor[c] === 3);
    setGame({ ...game, stars: game.stars - cost, decor, endingSeen: ending ? true : game.endingSeen });
    setToast(`${DECOR[color][level]}을 놓았어요`); track('decor_buy', { color, level: level + 1 });
    if (ending) setTimeout(() => setCompleted('white'), 500);
  };

  const resetGame = () => {
    if (!confirm('저장된 진행 상황을 모두 지울까요?')) return;
    localStorage.removeItem(STORAGE_KEY); setGame(emptyState()); setView('board'); setSettings(false);
  };

  const currentDragItem = drag ? game.board[drag.from] : null;
  const completedInfo = completed ? COLOR_INFO[completed] : null;
  const energyWait = game.energy >= 20 ? '가득 참' : `${Math.max(0, 3 - Math.floor((Date.now() - game.lastEnergyAt) / 60000))}:00`;

  if (!hydrated) return <main className="game-shell"><div className="loading">흐물흐물 빚는 중…</div></main>;

  if (!game.started) return (
    <main className="game-shell">
      <section className="phone intro-screen">
        <div className="moon" />
        <div className="intro-ghosts" aria-hidden="true">
          <img src="/mongle.png" alt="" /><img src="/meokgu.png" alt="" /><img src="/seolgi.png" alt="" />
        </div>
        <div className="intro-copy">
          <small>흩어진 마음이 돌아오는 곳</small><h1>흐물의 집</h1>
          <p>집으로 돌아가던 유령 가족이<br/>말랑한 반죽으로 흩어졌어요.</p>
          <p>같은 반죽을 포개어<br/>다시 유령의 모습을 빚어주세요.</p>
          <button className="primary-button" onClick={startGame}>첫 반죽 빚기 <span>→</span></button>
        </div>
      </section>
    </main>
  );

  return (
    <main className="game-shell">
      <section className="phone" aria-label="흐물의 집 게임">
        <header className="topbar">
          <button className="round-button" onClick={() => setSettings(true)} aria-label="설정">☰</button>
          <div className="brand"><span>흐물의 집</span><small>{view === 'board' ? '반죽이 된 유령들의 귀가일지' : view === 'home' ? '돌아온 유령들의 보금자리' : '흐물흐물한 기억의 기록'}</small></div>
          <button className="round-button" onClick={() => patchGame({ musicOn: !game.musicOn })} aria-label="음악 켜고 끄기">{game.musicOn ? '♪' : '×'}</button>
        </header>

        <section className="status-row" aria-label="게임 상태">
          <div className="status-pill energy"><span>●</span><b>{game.energy}</b><small>/20 · {energyWait}</small></div>
          <div className="status-pill"><span>✦</span><b>{game.stars}</b></div>
          <button className="daily-button" onClick={() => setDailyOpen(true)}><span>☾</span> 출석</button>
        </section>

        {view === 'board' && <BoardView game={game} drag={drag} generate={generate} receiveReward={receiveReward} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />}
        {view === 'home' && <HomeView game={game} buyDecor={buyDecor} />}
        {view === 'collection' && <CollectionView game={game} />}

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><span>◈</span>보드</button>
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><span>⌂</span>유령의 집</button>
          <button className={view === 'collection' ? 'active' : ''} onClick={() => setView('collection')}><span>◌</span>도감</button>
        </nav>

        {drag && <div className="trash-zone" data-trash>반죽 버리기</div>}
        {currentDragItem && <div className="drag-item" style={{ left: drag!.x, top: drag!.y }}><Dough item={currentDragItem} /></div>}
        {toast && <div className="toast" role="status">{toast}</div>}

        {dailyOpen && <Modal onClose={() => setDailyOpen(false)}><DailyModal game={game} status={dailyStatus()} onClaim={claimDaily} /></Modal>}
        {settings && <Modal onClose={() => setSettings(false)}><Settings game={game} patchGame={patchGame} resetGame={resetGame} /></Modal>}
        {confirmDelete !== null && <Modal onClose={() => setConfirmDelete(null)}><div className="simple-modal"><span className="modal-mark">⌁</span><h2>이 반죽을 버릴까요?</h2><p>버린 반죽은 다시 되돌릴 수 없어요.</p><div className="modal-actions"><button onClick={() => setConfirmDelete(null)}>간직하기</button><button className="dark" onClick={deleteItem}>버리기</button></div></div></Modal>}
        {completedInfo && <Modal onClose={() => setCompleted(null)}><div className={`ghost-complete ${completed}`}><small>{game.ghosts[completed!] > 1 ? '또 한 명이 집을 찾았어요' : '처음으로 모습을 되찾았어요'}</small><img src={completedInfo.image} alt={`${completedInfo.ghost} 완성 일러스트`} /><h2>{completedInfo.ghost}{game.ghosts[completed!] > 1 ? '의 친구' : ''}</h2><blockquote>“{completedInfo.quote}”</blockquote><p>{game.ghosts[completed!]}번째 {completedInfo.name} 유령이 집으로 돌아갔어요.</p><strong className="energy-reward">● 에너지 +5</strong><button className="primary-button" onClick={() => { setCompleted(null); setView('home'); }}>방으로 데려가기 <span>→</span></button></div></Modal>}
      </section>
    </main>
  );
}

function BoardView({ game, drag, generate, receiveReward, onPointerDown, onPointerMove, onPointerUp }: {
  game: GameState; drag: { from: number; x: number; y: number } | null; generate: () => void; receiveReward: () => void;
  onPointerDown: (index: number, event: React.PointerEvent) => void; onPointerMove: (event: React.PointerEvent) => void; onPointerUp: (event: React.PointerEvent) => void;
}) {
  const next = COLORS.find(color => game.ghosts[color] === 0) || 'black';
  const info = COLOR_INFO[next];
  const bases = game.board.reduce((sum, item) => sum + (item?.color === next ? 2 ** item.level : 0), 0);
  return <>
    <section className="quest-card">
      <div className={`tiny-ghost ${next}-ghost`} aria-hidden="true"><i/><i/></div>
      <div className="quest-copy"><span>{game.ghosts[next] ? '유령 가족 모으기' : '다음 귀가 준비'}</span><strong>{info.ghost}를 원래 모습으로 빚어주세요</strong><div className="progress"><i style={{ width: `${Math.min(100, bases / info.need * 100)}%` }} /></div></div>
      <b className="quest-count">{Math.min(info.need, bases)}/{info.need}</b>
    </section>
    {game.rewards.length > 0 && <button className="reward-box" onClick={receiveReward}>선물함 <b>{game.rewards.length}</b><small>한 개씩 보드로 받기</small></button>}
    <section className="board-wrap"><div className="mist mist-one"/><div className="mist mist-two"/>
      <div className="board" aria-label="5열 7행 머지 보드">
        {game.board.map((item, index) => <button data-index={index} className={`cell ${drag?.from === index ? 'dragging' : ''}`} key={index} aria-label={item ? `${COLOR_INFO[item.color].name} 반죽 ${item.level + 1}단계` : '빈 칸'} onPointerDown={e => onPointerDown(index, e)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>{item && <Dough item={item}/>}</button>)}
      </div>
    </section>
    <section className="generator-area"><p>반죽을 끌어 같은 모양 위에 포개어주세요</p><button className="generator" onClick={generate}><span className="generator-core"><i/><i/><i/></span><span className="generator-label"><b>반죽 만들기</b><small>에너지 1 · 50% / 30% / 20%</small></span></button></section>
  </>;
}

function Dough({ item }: { item: BoardItem }) {
  return <span className={`dough ${item.color} level-${item.level}`}><i/><i/><em>{item.level + 1}</em></span>;
}

function HomeView({ game, buyDecor }: { game: GameState; buyDecor: (color: GhostColor) => void }) {
  const total = COLORS.reduce((sum, color) => sum + game.ghosts[color], 0);
  return <section className="home-view"><div className="home-heading"><small>돌아온 유령 가족</small><h2>{total}명이 함께 살고 있어요</h2><p>방을 꾸미면 더 많은 친구들이 모습을 보여줘요.</p></div>
    <div className="rooms">{COLORS.map(color => { const info = COLOR_INFO[color]; const count = game.ghosts[color]; const level = game.decor[color]; const shown = Math.min(count, ROOM_CAPS[level]); return <article className={`room room-${color} ${count ? '' : 'locked'}`} key={color}>
      <header><div><small>{info.room}</small><h3>{info.ghost}와 친구들</h3></div><b>× {count}</b></header>
      <div className="room-stage">
        <img className="room-art" src={info.roomImage} alt={`${info.room} 장식`} style={{ opacity: .18 + level * .27 }}/>
        {count === 0 ? <div className="room-empty">아직 반죽의 흔적만 남아 있어요</div> : Array.from({ length: shown }, (_, i) => <img className="ghost-sprite" key={i} src={info.image} alt="" style={{ '--i': i } as React.CSSProperties}/>)}
      </div>
      <div className="decor-list">{DECOR[color].map((name, i) => <span className={i < level ? 'owned' : ''} key={name}>{i < level ? '◆' : '◇'} {name}</span>)}</div>
      <button onClick={() => buyDecor(color)} disabled={level >= 3}>{level >= 3 ? '방 꾸미기 완료' : count === 0 ? '유령을 먼저 찾아주세요' : `${DECOR[color][level]} · ✦ ${DECOR_COSTS[level]}`}</button>
    </article>; })}</div>
    {game.endingSeen && <div className="ending-note"><span>☾</span><div><b>저택에 불이 다시 켜졌어요</b><small>세 가족의 이야기는 계속됩니다.</small></div></div>}
  </section>;
}

function CollectionView({ game }: { game: GameState }) {
  return <section className="collection-view"><div className="home-heading"><small>유령 도감</small><h2>말랑했던 기억들</h2><p>반죽을 합칠수록 숨겨진 모습이 드러납니다.</p></div>
    {COLORS.map(color => { const info = COLOR_INFO[color]; return <article className={`collection-card ${color}`} key={color}><img src={info.image} alt={`${info.ghost} 일러스트`}/><div><small>{info.name} 유령 · 최초 반죽 {info.need}개</small><h3>{game.ghosts[color] ? info.ghost : '???'}</h3><p>{game.ghosts[color] ? info.quote : '아직 모습을 되찾지 못했어요.'}</p><b>{game.ghosts[color]}명 귀환</b></div></article>; })}
    <div className="rule-note"><b>빚는 법</b><p>같은 색과 같은 모양의 반죽 두 개를 끌어 포개세요. 검정은 8개, 보라는 16개, 하양은 32개의 최초 반죽이 필요합니다. 유령이 완성될 때마다 에너지 5를 돌려받아요.</p></div>
  </section>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-sheet"><button className="modal-close" onClick={onClose} aria-label="닫기">×</button>{children}</div></div>;
}

function DailyModal({ game, status, onClaim }: { game: GameState; status: { available: boolean; step: number }; onClaim: () => void }) {
  return <div className="daily-modal"><span className="modal-mark">☾</span><small>매일 밤 찾아오는 선물</small><h2>흐물 출석 일지</h2><p>하루를 놓치면 첫째 날부터 다시 시작해요.</p><div className="daily-days">{COLORS.map((color, index) => <div className={`${status.step === index + 1 ? 'today' : ''} ${!status.available && game.dailyStep === index + 1 ? 'claimed' : ''}`} key={color}><small>{index + 1}일</small><Dough item={{ id: 0, color, level: 0 }}/><b>{COLOR_INFO[color].name} ×2</b></div>)}</div><button className="primary-button" disabled={!status.available} onClick={onClaim}>{status.available ? '오늘의 반죽 받기' : '오늘은 이미 받았어요'}</button></div>;
}

function Settings({ game, patchGame, resetGame }: { game: GameState; patchGame: (patch: Partial<GameState>) => void; resetGame: () => void }) {
  return <div className="settings-modal"><span className="modal-mark">♪</span><small>흐물의 집</small><h2>설정</h2><label className="toggle-row"><span><b>배경 음악</b><small>조용한 오르골 선율</small></span><button className={game.musicOn ? 'on' : ''} onClick={() => patchGame({ musicOn: !game.musicOn })}><i/></button></label><label className="volume-row"><b>음악 크기</b><input type="range" min="0" max="1" step="0.05" value={game.volume} onChange={e => patchGame({ volume: Number(e.target.value) })}/></label><button className="reset-button" onClick={resetGame}>처음부터 다시 시작하기</button><p className="save-note">진행 상황은 이 브라우저에 자동으로 저장됩니다.</p></div>;
}
