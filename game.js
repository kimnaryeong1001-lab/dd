// 한국 현대사 시뮬레이션 게임 로직 (Game Engine with 3-Line Decision Outcome)

class HistoryGame {
  constructor() {
    this.currentRole = null;
    this.currentChapterIndex = 0;
    this.stats = {};
    this.historyLog = [];
    this.soundEnabled = true;
    this.audioCtx = null;

    this.initAudio();
    this.bindEvents();
  }

  // Web Audio API 효과음 생성기
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      console.warn("Web Audio not supported", e);
    }
  }

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'decision') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'chapter') {
      [260, 390, 520].forEach((freq, idx) => {
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.connect(g);
        g.connect(this.audioCtx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.05);
        g.gain.setValueAtTime(0.12, now + idx * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        o.start(now + idx * 0.05);
        o.stop(now + 0.6);
      });
    } else if (type === 'ending') {
      [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.connect(g);
        g.connect(this.audioCtx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.12);
        g.gain.setValueAtTime(0.18, now + idx * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        o.start(now + idx * 0.12);
        o.stop(now + 1.4);
      });
    }
  }

  // 화면상에 부유하는 스탯 변동 애니메이션 뱃지 (+20 사회의식 등)
  spawnFloatingStat(text, isPositive, clickEvent) {
    const el = document.createElement('div');
    el.className = `floating-stat ${isPositive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`;
    el.textContent = text;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (clickEvent) {
      x = clickEvent.clientX + (Math.random() * 60 - 30);
      y = clickEvent.clientY - 20;
    }

    el.style.left = `${Math.max(20, Math.min(window.innerWidth - 120, x))}px`;
    el.style.top = `${Math.max(20, y)}px`;

    document.body.appendChild(el);

    setTimeout(() => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 1400);
  }

  bindEvents() {
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        soundBtn.innerHTML = this.soundEnabled 
          ? '<i class="fa-solid fa-volume-high"></i>' 
          : '<i class="fa-solid fa-volume-xmark text-stone-400"></i>';
      });
    }

    const nextBtn = document.getElementById('modal-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.playSound('click');
        this.closeModalAndAdvance();
      });
    }
  }

  startRole(roleId) {
    const roleData = GAME_DATA.roles[roleId];
    if (!roleData) return;

    this.currentRole = roleId;
    this.currentChapterIndex = 0;
    this.historyLog = [];
    this.stats = {};

    // 스탯 초기화
    roleData.stats.forEach(st => {
      this.stats[st.id] = st.initial;
    });

    // 화면 전환
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('screen-ending').classList.add('hidden');
    const gameScreen = document.getElementById('screen-game');
    gameScreen.classList.remove('hidden');

    // 헤더 상태 표시 활성화
    const headerStatus = document.getElementById('header-status');
    headerStatus.classList.remove('hidden');
    headerStatus.classList.add('flex');

    const roleBadge = document.getElementById('header-role-badge');
    roleBadge.textContent = `${roleData.icon} ${roleData.name}`;
    roleBadge.className = `px-3.5 py-1 rounded-full font-bold border shadow-sm ${roleData.badgeColor}`;

    document.getElementById('role-title-detail').textContent = `${roleData.name}의 시선`;

    this.renderStats();
    this.loadChapter(0);
    this.playSound('chapter');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderStats() {
    const roleData = GAME_DATA.roles[this.currentRole];
    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    roleData.stats.forEach(st => {
      const val = Math.max(0, Math.min(100, this.stats[st.id]));
      
      const item = document.createElement('div');
      item.className = "bg-[#fbf9f4] p-3 rounded-xl border border-stone-200 shadow-sm transition hover:border-amber-300";
      item.innerHTML = `
        <div class="flex items-center justify-between text-xs sm:text-sm mb-1.5">
          <span class="text-stone-800 font-bold flex items-center gap-1.5">
            <span class="text-base">${st.icon}</span> ${st.name}
          </span>
          <span class="font-mono font-black text-sm ${val < 30 ? 'text-rose-600' : val > 70 ? 'text-amber-600' : 'text-stone-800'}">
            ${val}
          </span>
        </div>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill ${st.color}" style="width: ${val}%;"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  formatFootnotes(text) {
    if (!text) return "";
    return text.replace(/\[(\d+)\]/g, (match, p1) => {
      return `<button type="button" class="footnote-ref" onclick="highlightFootnote(${p1})">[${p1}]</button>`;
    });
  }

  loadChapter(chapterIndex) {
    this.currentChapterIndex = chapterIndex;
    const chapter = GAME_DATA.chapters[chapterIndex];
    if (!chapter) {
      this.showEnding();
      return;
    }

    const storyData = chapter[this.currentRole];

    // 헤더 및 태그 업데이트
    document.getElementById('header-era-badge').textContent = `${chapterIndex + 1} / ${GAME_DATA.chapters.length}장`;
    document.getElementById('story-era-tag').textContent = chapter.era;
    document.getElementById('story-year-tag').textContent = chapter.year;

    // 본문 내용 렌더링
    document.getElementById('story-headline').textContent = storyData.headline;
    document.getElementById('story-quote').innerHTML = this.formatFootnotes(storyData.quote);
    document.getElementById('story-body').innerHTML = this.formatFootnotes(storyData.body);

    // 각주 목록 동적 렌더링
    const footnotesContainer = document.getElementById('footnotes-list');
    footnotesContainer.innerHTML = '';
    if (chapter.footnotes && chapter.footnotes.length > 0) {
      document.getElementById('footnotes-section').classList.remove('hidden');
      chapter.footnotes.forEach((fn, idx) => {
        const fnCard = document.createElement('div');
        fnCard.id = `fn-card-${idx + 1}`;
        fnCard.className = "footnote-card";
        fnCard.innerHTML = `
          <div class="flex items-start gap-1.5">
            <span class="font-bold text-amber-800">[${idx + 1}] ${fn.term}:</span>
            <span class="text-stone-700 leading-relaxed font-sans">${fn.desc}</span>
          </div>
        `;
        footnotesContainer.appendChild(fnCard);
      });
    } else {
      document.getElementById('footnotes-section').classList.add('hidden');
    }

    // 워터마크 아이콘
    const wm = document.getElementById('era-watermark-icon');
    wm.className = `fa-solid ${chapter.watermark || 'fa-landmark'}`;

    // 선택지 버튼 렌더링
    const choicesContainer = document.getElementById('choices-container');
    choicesContainer.innerHTML = '';

    storyData.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = "choice-btn w-full p-4 sm:p-5 rounded-2xl text-left text-stone-900 flex items-center gap-4 group cursor-pointer";
      btn.innerHTML = `
        <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 group-hover:bg-amber-600 text-amber-900 group-hover:text-white text-xs sm:text-sm font-black flex items-center justify-center shrink-0 transition">
          ${idx + 1}
        </span>
        <div class="flex-grow">
          <p class="font-serif text-base sm:text-lg font-bold leading-snug group-hover:text-amber-800 transition">${choice.text}</p>
        </div>
        <i class="fa-solid fa-arrow-right-long text-stone-400 group-hover:text-amber-600 group-hover:translate-x-1.5 transition text-base shrink-0"></i>
      `;
      btn.addEventListener('click', (e) => {
        this.selectChoice(choice, chapter, e);
      });
      choicesContainer.appendChild(btn);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectChoice(choice, chapter, event) {
    this.playSound('decision');

    // 스탯 변화 적용 및 플로팅 뱃지 표시
    const statChanges = [];
    const roleStats = GAME_DATA.roles[this.currentRole].stats;

    let delayOffset = 0;
    for (const [statKey, change] of Object.entries(choice.effects)) {
      if (this.stats[statKey] !== undefined) {
        this.stats[statKey] = Math.max(0, Math.min(100, this.stats[statKey] + change));
        const statMeta = roleStats.find(s => s.id === statKey);
        if (statMeta && change !== 0) {
          const sign = change > 0 ? `+${change}` : `${change}`;
          const isPositive = change > 0;
          const colorClass = isPositive ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold';
          statChanges.push(`<span class="${colorClass}">${statMeta.name} ${sign}</span>`);

          setTimeout(() => {
            this.spawnFloatingStat(`${statMeta.icon} ${statMeta.name} ${sign}`, isPositive, event);
          }, delayOffset);
          delayOffset += 200;
        }
      }
    }

    this.renderStats();

    // 로그 기록
    this.historyLog.push({
      chapter: chapter.era,
      year: chapter.year,
      choice: choice.text,
      outcome: choice.outcome
    });

    // 모달 띄우기
    setTimeout(() => {
      this.showFactModal(choice, chapter, statChanges);
    }, 400);
  }

  showFactModal(choice, chapter, statChanges) {
    document.getElementById('modal-chapter-tag').textContent = `${chapter.era} (${chapter.year})`;
    document.getElementById('modal-outcome-text').textContent = choice.outcome;
    document.getElementById('modal-stat-changes').innerHTML = statChanges.length > 0 
      ? statChanges.join(' · ') 
      : '<span class="text-stone-500">지표 변화 없음</span>';
    document.getElementById('modal-fact-text').textContent = choice.fact;

    const modal = document.getElementById('fact-modal');
    modal.classList.remove('hidden');
  }

  closeModalAndAdvance() {
    const modal = document.getElementById('fact-modal');
    modal.classList.add('hidden');

    if (this.currentChapterIndex + 1 < GAME_DATA.chapters.length) {
      this.playSound('chapter');
      this.loadChapter(this.currentChapterIndex + 1);
    } else {
      this.showEnding();
    }
  }

  // ⭐ 플레이어의 실제 결정(선택 히스토리 및 스탯)에 기반한 맞춤형 3줄 결과 생성기
  generateThreeLineResult() {
    const s = this.stats;
    const r = this.currentRole;
    let line1 = "";
    let line2 = "";
    let line3 = "";

    if (r === 'student') {
      // 1줄: 학생의 삶의 궤적
      if ((s.awareness || 50) >= 65) {
        line1 = "1. 불의에 타협하지 않고 거리와 광장에서 최루탄에 맞서며 민주화와 인권의 깃발을 지켜낸 '뜨거운 청년 투사'의 길을 걸었습니다.";
      } else if ((s.knowledge || 50) >= 65) {
        line1 = "1. 피난 천막과 혼란 속에서도 펜을 놓지 않고 필사적으로 학업에 매진하여 국가 발전과 기술을 떠받친 '실력 있는 지식인'의 길을 걸었습니다.";
      } else {
        line1 = "1. 시대적 양심의 부름과 개인적 진로의 갈림길 사이에서 매 순간 치열하게 고뇌하며 현실을 묵묵히 헤쳐나간 '성실한 청년'의 길을 걸었습니다.";
      }

      // 2줄: 남겨진 사회적 영향
      if ((s.hope || 50) >= 60) {
        line2 = "2. 당신이 남긴 불꽃과 희망은 혹독한 독재와 경제 위기를 뚫고 오늘날 후배 청년들이 자유롭게 꿈꿀 수 있는 민주 사회의 든든한 토양이 되었습니다.";
      } else {
        line2 = "2. 수많은 시대의 아픔과 동료들의 희생을 가슴에 묻어야 했지만, 그 깊은 상처와 기억은 대한민국 역사가 뒤로 후퇴하지 않게 지탱한 보이지 않는 방파제가 되었습니다.";
      }

      // 3줄: 최종 결론
      line3 = "3. 책과 최루탄, 배움과 생존 사이에서 당신이 내렸던 결단들은 한 시대의 청춘이 역사를 온몸으로 밀고 나아간 증거였습니다.";

    } else if (r === 'citizen') {
      // 1줄: 어른의 삶의 궤적
      if ((s.wealth || 40) >= 60) {
        line1 = "1. 피난길 장사와 중동 건설 현장, 밤낮없는 노동 속에서 온몸을 바쳐 내 가족의 밥그릇과 번듯한 삶의 터전을 일구어낸 '억척스러운 가장'이었습니다.";
      } else if ((s.socialTrust || 50) >= 60) {
        line1 = "1. 가난과 부도의 시련 속에서도 이웃과 끼니를 나누고 장롱 속 돌반지를 꺼내들며 공동체의 신뢰와 온기를 지켜낸 '따뜻한 시민'이었습니다.";
      } else {
        line1 = "1. 가족을 부양해야 하는 절박한 책임감과 거친 사회적 격변 속에서 타협과 희생으로 자식들을 키워낸 '위대한 생활인'이었습니다.";
      }

      // 2줄: 남겨진 사회적 영향
      if ((s.familyHappiness || 50) >= 60) {
        line2 = "2. 당신의 거친 손발과 땀방울 덕분에 자녀들은 굶주리지 않고 더 넓은 세상으로 나아갈 수 있었으며, 한강의 기적을 이룬 진정한 주역으로 남았습니다.";
      } else {
        line2 = "2. 개인의 안락을 포기한 채 가족과 회사를 위해 헌신해야 했던 당신의 희생 위에, 오늘의 풍요롭고 안전한 대한민국이 우뚝 서 있습니다.";
      }

      // 3줄: 최종 결론
      line3 = "3. 밥을 짓고 가정을 지켜낸 당신의 매 순간의 선택이 있었기에, 대한민국이라는 거대한 공동체는 파국을 딛고 다시 일어설 수 있었습니다.";

    } else {
      // 1줄: 정치인의 삶의 궤적
      if ((s.economy || 40) >= 65) {
        line1 = "1. 대중의 비판과 인권의 후퇴라는 냉혹한 오명을 감수하면서도 고속도로와 중화학공업 등 국가 압축 성장의 기틀을 세운 '개발 드라이브 지도자'였습니다.";
      } else if ((s.approval || 50) >= 60) {
        line1 = "1. 국민들의 민주화 열망과 복지 요구를 외면하지 않고 유혈 사태 대신 대타협과 제도 개혁을 수용해 민주주의를 지켜낸 '통합의 정치가'였습니다.";
      } else {
        line1 = "1. 분단의 냉전 현실과 붕괴하는 경제 위기(IMF)의 칼날 위에서 국가의 생존과 체제를 유지하기 위해 고뇌하며 결단했던 '국정 책임자'였습니다.";
      }

      // 2줄: 남겨진 사회적 영향
      if ((s.diplomacy || 50) >= 60) {
        line2 = "2. 당신의 과감한 정책적 결단은 한국을 폐허의 최빈국에서 세계 10대 경제 대국이자 국제사회가 인정하는 당당한 선진국 반열에 올려놓았습니다.";
      } else {
        line2 = "2. 수많은 역사적 공과 과를 동시에 남겼으나, 당신이 짊어졌던 고독한 결단과 무게는 오늘날 우리가 마주한 사회적 제도와 시스템의 뼈대가 되었습니다.";
      }

      // 3줄: 최종 결론
      line3 = "3. 완벽한 정답이 없던 가혹한 갈림길에서 당신이 내린 무거운 선택들이 모여, 오늘날 대한민국이라는 거대한 역사의 물줄기를 완성했습니다.";
    }

    return [line1, line2, line3];
  }

  showEnding() {
    this.playSound('ending');

    document.getElementById('screen-game').classList.add('hidden');
    const endingScreen = document.getElementById('screen-ending');
    endingScreen.classList.remove('hidden');

    const roleData = GAME_DATA.roles[this.currentRole];
    document.getElementById('ending-summary-text').textContent = roleData.endSummary;

    // ⭐ 요청하신 결정에 따른 3줄 결과 요약 주입 ⭐
    const threeLines = this.generateThreeLineResult();
    const resultBox = document.getElementById('ending-3line-result');
    resultBox.innerHTML = `
      <div class="p-3 bg-white/80 rounded-xl border border-amber-200/90 shadow-sm flex items-start gap-2.5">
        <span class="text-amber-700 font-black shrink-0 text-base">🌱</span>
        <p class="font-medium text-stone-900">${threeLines[0]}</p>
      </div>
      <div class="p-3 bg-white/80 rounded-xl border border-amber-200/90 shadow-sm flex items-start gap-2.5">
        <span class="text-emerald-700 font-black shrink-0 text-base">🏛️</span>
        <p class="font-medium text-stone-900">${threeLines[1]}</p>
      </div>
      <div class="p-3 bg-white/80 rounded-xl border border-amber-200/90 shadow-sm flex items-start gap-2.5">
        <span class="text-blue-700 font-black shrink-0 text-base">✨</span>
        <p class="font-bold text-amber-950">${threeLines[2]}</p>
      </div>
    `;

    // 최종 스탯 렌더링
    const finalStatsContainer = document.getElementById('ending-final-stats');
    finalStatsContainer.innerHTML = '';
    roleData.stats.forEach(st => {
      const val = Math.max(0, Math.min(100, this.stats[st.id]));
      const div = document.createElement('div');
      div.className = "flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200";
      div.innerHTML = `
        <span class="text-stone-700 font-bold">${st.icon} ${st.name}</span>
        <span class="font-mono font-black text-amber-700 text-sm sm:text-base">${val}점</span>
      `;
      finalStatsContainer.appendChild(div);
    });

    // 평가 총평 생성
    const evalContainer = document.getElementById('ending-evaluation');
    let totalScore = 0;
    roleData.stats.forEach(st => totalScore += this.stats[st.id]);
    const avgScore = Math.round(totalScore / roleData.stats.length);

    let evaluationComment = "";
    if (this.currentRole === 'student') {
      evaluationComment = `격변의 파고 속에서 당신은 불의에 타협하지 않고 시대의 아픔에 공감하는 청년 지식인으로 살았습니다. 당신의 고뇌가 헛되지 않았음을 역사가 증명하고 있습니다. (평균 생애 지수: ${avgScore}점)`;
    } else if (this.currentRole === 'citizen') {
      evaluationComment = `전쟁과 가난, 경제 위기 속에서도 가족의 삶의 터전을 묵묵히 일구어냈습니다. 당신의 헌신과 눈물이 오늘날 우리 가족과 사회의 번영을 지탱했습니다. (평균 생애 지수: ${avgScore}점)`;
    } else {
      evaluationComment = `냉혹한 안보와 경제의 갈림길에서 수많은 번민과 비판을 감당하며 국가의 물줄기를 돌렸습니다. 당신의 정책적 고뇌 위에 현재의 대한민국이 서 있습니다. (평균 생애 지수: ${avgScore}점)`;
    }

    evalContainer.innerHTML = `
      <p class="font-serif text-stone-800 text-sm sm:text-base leading-relaxed">
        <strong class="text-amber-800">💡 생애 회고:</strong> ${evaluationComment}
      </p>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  restartToHome() {
    this.playSound('click');
    document.getElementById('screen-game').classList.add('hidden');
    document.getElementById('screen-ending').classList.add('hidden');
    document.getElementById('screen-start').classList.remove('hidden');

    const headerStatus = document.getElementById('header-status');
    headerStatus.classList.add('hidden');
    headerStatus.classList.remove('flex');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// 싱글톤 게임 인스턴스
let game;

window.addEventListener('DOMContentLoaded', () => {
  game = new HistoryGame();
});

// 전역 호출 함수들
function selectRole(roleId) {
  if (game) game.startRole(roleId);
}

function startSpecificRole(roleId) {
  if (game) game.startRole(roleId);
}

function restartToHome() {
  if (game) game.restartToHome();
}

// 각주 번호 클릭 시 해당 각주 카드로 스크롤 및 하이라이트
function highlightFootnote(index) {
  const target = document.getElementById(`fn-card-${index}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50');
    setTimeout(() => {
      target.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
    }, 1800);
  }
}
