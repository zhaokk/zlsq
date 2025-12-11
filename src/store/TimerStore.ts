import { makeAutoObservable, runInAction } from "mobx";
import { Sound } from "../utils/Sound";

export enum Mode { FORTRESS=0, NORMAL=1, PASSWORD=2, INFINITE=3 }
export enum State {
  IDLE=0, SET_TIME=1, PRELOCK=2,
  LOCKED_TIMED=3, LOCKED_PASSWORD=4, LOCKED_INFINITE=5,
  PW_INPUT=6, INFINITE_DELAY=7, INFINITE_PENDING=8,
  EXTEND_SET=9, PW_MASTER_VERIFY=10, PW_CHANGE=11,
  MEM_RECALL=12
}

const ARM_COUNTDOWN = 5;
const EXIT_TIMEOUT = 10;
const SET_TIME_EXIT_TIMEOUT = 60;
const INACTIVITY_SEC = 10;  // 修改为 10秒无操作自动息屏
const MAX_DAYS = 400;
const INFINITE_DELAY_SEC = 3*60;
const INFINITE_PENDING_SEC = 5*60;
const MIN_LOCK_FOR_CHECKIN = 30*60;
const MIN_INTERVAL_BETWEEN_CHECKIN = 18*3600;
const PROGRESS_RESET_SEC = 72*3600;
const ONE_DAY_SEC = 24*3600;
const PW_IDLE_TIMEOUT = 10;
const MASTER_PW = [6,6,6,6,6,6,6];
const DOUBLE_TAP_MS = 350;

function dhmToSec(d: number, h: number, m: number){ return d*86400 + h*3600 + m*60; }
function secToDHMS(sec: number){
  if(sec<0) sec=0;
  let d=Math.floor(sec/86400); sec%=86400;
  let h=Math.floor(sec/3600);  sec%=3600;
  let m=Math.floor(sec/60);
  let s=sec%60;
  return {d,h,m,s};
}
function arrEqual(a: number[], b: number[]){
  if(a.length!==b.length) return false;
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
  return true;
}

export class TimerStore {
  // Simulated clock (seconds) decoupled from real time; advanced in tick or via fast-forward.
  simTimeSec = Math.floor(Date.now()/1000);
  lastRealTickMs = Date.now();
  mode = Mode.FORTRESS;
  state = State.IDLE;
  locked = false;
  screenOff = false;
  childLock = false;

  lidClosed = true;
  latchRetracted = true;

  lockStartTime: number | null = null;
  setDays = 0;
  setHours = 0;
  setMinutes = 0;
  cursorIdx = 0;

  prelockStart: number | null = null;
  lockEndTime: number | null = null;
  lockDurationSec: number | null = null;

  infiniteStartTime: number | null = null;
  infiniteDelayEnd: number | null = null;
  infinitePendingEnd: number | null = null;

  extendBaseSec = 0;

  pwDigits = [0,0,0,0,0,0,0];
  lastActivity = 0;
  lastInput = 0;

  progressCount = 0;
  lastCheckinTime: number | null = null;

  historyTimes: number[] = [];
  memIndex = 0;

  isFlashingReward = false;
  warnLockIcon = false;
  childLockBlink = false;

  unlockPwd = [0,0,0,0,0,0,0];
  fortressPw = [
    [1,1,1,1,1,1,1],
    [2,2,2,2,2,2,2],
    [3,3,3,3,3,3,3],
    [4,4,4,4,4,4,4],
    [5,5,5,5,5,5,5],
    [6,6,6,6,6,6,6]
  ];
  fortressUsed = [false,false,false,false,false,false];

  buttons = {
    set:  { isDown:false, downTime:0 },
    back: { isDown:false, downTime:0 },
    lock: { isDown:false, downTime:0 }
  };

  lastLockTapTime = 0;
  lastBackTapTime = 0;
  
  comboChildHandled = false;
  comboResetHandled = false;
  back10Handled = false;
  
  setLongTimer: any = null;
  setLongUsed = false;

  childLockBlinkTimer: any = null;

  tempMessage = "";
  tempMessageTimer: any = null;

  infoText = ""; // To replace infoLine.textContent

  constructor() {
    makeAutoObservable(this);
    this.simTimeSec = Math.floor(Date.now()/1000);
    this.lastRealTickMs = Date.now();
    this.lastActivity = this.simTimeSec;
    this.lastInput = this.simTimeSec;
    this.updateInfoText();
  }

  nowSec(){
    return this.simTimeSec;
  }

  setTempMessage(msg: string, duration: number = 3000){
    this.tempMessage = msg;
    if(this.tempMessageTimer) clearTimeout(this.tempMessageTimer);
    this.tempMessageTimer = setTimeout(() => {
      runInAction(() => {
        this.tempMessage = "";
      });
    }, duration);
  }

  // Actions
  bumpInput() { this.lastInput = this.nowSec(); }
  
  bumpActivity() {
    const now = this.nowSec();
    if(this.screenOff){
      this.screenOff=false;
      this.lastActivity = now;
      return false;
    }
    this.lastActivity = now;
    return true;
  }

  setSecondsClamped(total: number){
    if(total<0) total=0;
    // Clamp to the maximum representable time (400 days, 23:59:59).
    const maxTotal = (MAX_DAYS + 1) * 86400 - 1;
    if(total>maxTotal) total=maxTotal;
    let {d,h,m} = secToDHMS(total);
    this.setDays=d; this.setHours=h; this.setMinutes=m;
  }

  applyCursorStep(dir: number){
    // Convert edits into seconds so overflow/borrow will naturally carry to the left.
    let deltaSec = 0;
    if(this.cursorIdx >= 5){ // Minutes
      const step = (this.cursorIdx === 5) ? 10 : 1;
      deltaSec = dir * step * 60;
    }
    else if(this.cursorIdx >= 3){ // Hours
      const step = (this.cursorIdx === 3) ? 10 : 1;
      deltaSec = dir * step * 3600;
    }
    else { // Days
      let step = 0;
      if(this.cursorIdx === 0) step = 100;
      if(this.cursorIdx === 1) step = 10;
      if(this.cursorIdx === 2) step = 1;
      deltaSec = dir * step * 86400;
    }

    const totalSec = dhmToSec(this.setDays, this.setHours, this.setMinutes) + deltaSec;
    this.setSecondsClamped(totalSec);
  }

  addHistory(sec: number){
    if(sec<=0) return;
    const idx = this.historyTimes.indexOf(sec);
    if(idx>=0) this.historyTimes.splice(idx,1);
    this.historyTimes.unshift(sec);
    if(this.historyTimes.length>5) this.historyTimes.pop();
  }

  handle21OnAutoUnlock(now: number, isEmergency: boolean){
    if(this.mode!==Mode.FORTRESS) return;

    const start = this.lockStartTime;
    const durationSec = start!=null ? Math.max(0, Math.floor(now - start)) : (this.lockDurationSec ?? 0);
    this.lockStartTime = null;

    // Step 1: emergency unlock -> fail, no progress.
    if(isEmergency) return;

    // Step 2: 18h cooldown from last successful check-in (based on start time).
    if(this.lastCheckinTime!=null && start!=null && (start - this.lastCheckinTime) < MIN_INTERVAL_BETWEEN_CHECKIN){
      return;
    }

    // Step 3: scoring by duration.
    if(durationSec < MIN_LOCK_FOR_CHECKIN) return;

    let earned = 0;
    if(durationSec < ONE_DAY_SEC){
      earned = 1;
    }else{
      earned = 1 + Math.floor(durationSec / ONE_DAY_SEC);
    }

    if(this.progressCount>=21){
      this.progressCount = 0;
    }

    const next = this.progressCount + earned;
    if(next >= 21){
      this.triggerRewardFlash();
      this.playRewardMelody();
      this.progressCount = 0;
    }else{
      this.progressCount = next;
    }

    // Step 4: reset cooldown anchor to this unlock time.
    this.lastCheckinTime = now;
  }

  triggerRewardFlash() {
    this.isFlashingReward = true;
    setTimeout(() => {
        this.stopRewardFlash();
    }, 3000);
  }

  triggerLockWarning() {
    this.warnLockIcon = true;
    setTimeout(() => {
      runInAction(() => {
        this.warnLockIcon = false;
      });
    }, 1000);
  }

  stopRewardFlash() {
      this.isFlashingReward = false;
  }

  playRewardMelody() {
    const seq = [
      [784, 0.18], [880, 0.18], [988, 0.18], [1047, 0.18],
      [1175, 0.2], [1319, 0.2], [1175, 0.2], [988, 0.2]
    ];
    seq.forEach(([freq, dur], idx) => {
      setTimeout(() => Sound.playTone(freq, dur), idx * 200);
    });
  }

  get modeName(){
    switch(this.mode){
      case Mode.FORTRESS: return "堡垒模式";
      case Mode.NORMAL:   return "普通模式";
      case Mode.PASSWORD: return "密码锁模式";
      case Mode.INFINITE: return "无限模式";
    }
    return "";
  }

  updateInfoText() {
    // Logic moved from updateDisplay to here or computed
    // For now, we'll update it in actions or tick where it changes
    // But actually, it's better to have it as a computed property based on state
  }

  // Button Handlers
  onUp(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }

    if(this.state===State.IDLE && !this.locked &&
       (this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL) &&
       this.historyTimes.length>0){
      this.state=State.MEM_RECALL;
      this.memIndex=0;
      const {d,h,m}=secToDHMS(this.historyTimes[this.memIndex]);
      this.setDays=d; this.setHours=h; this.setMinutes=m;
      this.bumpInput();
      return;
    }

    if(this.state===State.MEM_RECALL){
      this.memIndex = (this.memIndex - 1 + this.historyTimes.length) % this.historyTimes.length;
      const {d,h,m}=secToDHMS(this.historyTimes[this.memIndex]);
      this.setDays=d; this.setHours=h; this.setMinutes=m;
      this.bumpInput();
      return;
    }

    if(this.state===State.SET_TIME || this.state===State.EXTEND_SET){
      this.applyCursorStep(+1);
      this.bumpInput();
    }else if(
      this.state===State.PW_INPUT ||
      this.state===State.PW_MASTER_VERIFY ||
      this.state===State.PW_CHANGE
    ){
      this.pwDigits[this.cursorIdx] = (this.pwDigits[this.cursorIdx]+1)%10;
    }
  }

  onDown(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }

    if(this.state===State.IDLE && !this.locked &&
       (this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL) &&
       this.historyTimes.length>0){
      this.state=State.MEM_RECALL;
      this.memIndex=0;
      const {d,h,m}=secToDHMS(this.historyTimes[this.memIndex]);
      this.setDays=d; this.setHours=h; this.setMinutes=m;
      this.bumpInput();
      return;
    }

    if(this.state===State.MEM_RECALL){
      this.memIndex = (this.memIndex + 1) % this.historyTimes.length;
      const {d,h,m}=secToDHMS(this.historyTimes[this.memIndex]);
      this.setDays=d; this.setHours=h; this.setMinutes=m;
      this.bumpInput();
      return;
    }

    if(this.state===State.SET_TIME || this.state===State.EXTEND_SET){
      this.applyCursorStep(-1);
      this.bumpInput();
    }else if(
      this.state===State.PW_INPUT ||
      this.state===State.PW_MASTER_VERIFY ||
      this.state===State.PW_CHANGE
    ){
      this.pwDigits[this.cursorIdx] = (this.pwDigits[this.cursorIdx]+9)%10;
    }
  }

  onSetClick(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }

    if(this.state===State.IDLE){
      if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL){
        this.state=State.SET_TIME;
        this.cursorIdx=0;
        this.bumpInput();
      }
    }else if(
      this.state===State.SET_TIME ||
      this.state===State.PW_INPUT ||
      this.state===State.EXTEND_SET ||
      this.state===State.PW_MASTER_VERIFY ||
      this.state===State.PW_CHANGE
    ){
      this.cursorIdx=(this.cursorIdx+1)%7;
      if(this.state===State.SET_TIME || this.state===State.EXTEND_SET) this.bumpInput();
    }
  }

  onBackClick(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }

    if(this.locked && (this.state===State.LOCKED_TIMED || this.state===State.LOCKED_PASSWORD || this.state===State.LOCKED_INFINITE)){
      const nowMs = performance.now();
      if(nowMs - this.lastBackTapTime < DOUBLE_TAP_MS){
        this.lastBackTapTime = 0;
        this.onDoubleBack();
      } else {
        this.lastBackTapTime = nowMs;
        this.setTempMessage("双击返回键解锁");
      }
      return;
    }

    if(this.state===State.SET_TIME){
      this.setDays=0; this.setHours=0; this.setMinutes=0;
      this.state=State.IDLE;
      return;
    }
    else if(this.state===State.MEM_RECALL){
      this.setDays=0; this.setHours=0; this.setMinutes=0;
      this.state=State.IDLE;
      return;
    }
    else if(this.state===State.PRELOCK){
      this.prelockStart = null;
      if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL){
        this.state = State.SET_TIME;
      }else{
        this.state = State.IDLE;
      }
      return;
    }
    else if(this.state===State.PW_INPUT){
      if(this.locked){
        if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL) this.state=State.LOCKED_TIMED;
        else if(this.mode===Mode.PASSWORD) this.state=State.LOCKED_PASSWORD;
        else if(this.mode===Mode.INFINITE) this.state=State.LOCKED_INFINITE;
      }else{
        this.state=State.IDLE;
      }
      return;
    }
    else if(this.state===State.INFINITE_DELAY || this.state===State.INFINITE_PENDING){
      this.state=State.LOCKED_INFINITE;
      this.infiniteDelayEnd=null;
      this.infinitePendingEnd=null;
      return;
    }
    else if(this.state===State.EXTEND_SET){
      this.state=State.LOCKED_TIMED;
      return;
    }
    else if(this.state===State.PW_MASTER_VERIFY || this.state===State.PW_CHANGE){
      this.state=State.IDLE;
      return;
    }
  }

  onLockClick(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }

    if(!this.locked && (this.mode===Mode.PASSWORD || this.mode===Mode.INFINITE) && this.state===State.IDLE){
      const nowMs = performance.now();
      if(nowMs - this.lastLockTapTime < DOUBLE_TAP_MS){
        this.lastLockTapTime = 0;
      }else{
        this.lastLockTapTime = nowMs;
        this.setTempMessage("双击 LOCK 锁定");
        return;
      }
    }

    if(this.state===State.MEM_RECALL){
      if(!this.lidClosed){
        this.setTempMessage("盖子未合上，无法上锁");
        Sound.warn();
        this.triggerLockWarning();
        return;
      }
      if(!this.latchRetracted){
        this.setTempMessage("锁舌未缩回，无法上锁");
        Sound.warn();
        return;
      }
      this.prelockStart = this.nowSec();
      this.state=State.PRELOCK;
      Sound.beep();
      return;
    }

    if(this.state===State.PW_MASTER_VERIFY){
      if(arrEqual(this.pwDigits, MASTER_PW)){
        this.unlockPwd.forEach((v,i)=>this.pwDigits[i]=v);
        this.state=State.PW_CHANGE;
        this.cursorIdx=0;
        this.setTempMessage("请输入新解锁密码");
      }else{
        this.setTempMessage("主密码错误");
        this.state=State.IDLE;
      }
      return;
    }
    if(this.state===State.PW_CHANGE){
      this.unlockPwd = this.pwDigits.slice();
      this.setTempMessage("解锁密码已保存");
      this.state=State.IDLE;
      return;
    }

    if(this.locked && this.state===State.EXTEND_SET){
      const now = this.nowSec();
      const newSec = dhmToSec(this.setDays,this.setHours,this.setMinutes);
      if(newSec<=this.extendBaseSec){
        this.setTempMessage("需大于剩余时间");
      }else{
        this.lockEndTime = now + newSec;
        if(this.lockDurationSec!=null) this.lockDurationSec += (newSec-this.extendBaseSec);
        this.addHistory(newSec);
        this.state=State.LOCKED_TIMED
        this.setTempMessage("已延长");
      }
      return;
    }

    if(!this.locked){
      if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL){
        if(dhmToSec(this.setDays,this.setHours,this.setMinutes)<=0){
          this.setTempMessage("请先设定锁定时间");
          Sound.warn();
          return;
        }
      }
      if(!this.lidClosed){
        this.setTempMessage("盖子未合上，无法上锁");
        Sound.warn();
        this.triggerLockWarning();
        return;
      }
      if(!this.latchRetracted){
        this.setTempMessage("锁舌未缩回，无法上锁");
        Sound.warn();
        return;
      }

      this.prelockStart = this.nowSec();
      this.state = State.PRELOCK;
      Sound.beep();
    }else{
      if(this.state===State.PW_INPUT){
        this.checkPassword();
        return;
      }
    }
  }

  onDoubleBack(){
    if(!this.bumpActivity()) return;
    if(this.childLock){ return; }
    if(!this.locked) return;

    if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL || this.mode===Mode.PASSWORD){
      this.state=State.PW_INPUT;
      this.pwDigits=[0,0,0,0,0,0,0];
      this.cursorIdx=0;
    }else if(this.mode===Mode.INFINITE){
      this.state=State.INFINITE_DELAY;
        this.infiniteDelayEnd = this.nowSec() + INFINITE_DELAY_SEC;
    }
  }

  checkPassword(){
    const entered = this.pwDigits;

    if(this.mode===Mode.FORTRESS){
      let ok=false;
      for(let i=0;i<this.fortressPw.length;i++){
        if(!this.fortressUsed[i] && arrEqual(entered, this.fortressPw[i])){
          ok=true;
          this.fortressUsed[i]=true;
          break;
        }
      }
      if(ok){
        const now = this.nowSec();
        this.locked=false;
        this.lockEndTime=null;
        this.lockDurationSec=null;
        this.lockStartTime=null;
        this.latchRetracted=true;
        this.state=State.IDLE;
        this.handle21OnAutoUnlock(now, true);
        this.setTempMessage("紧急解锁成功");
        Sound.playTone(1200, 0.1); setTimeout(()=>Sound.playTone(1500, 0.1), 150); setTimeout(()=>Sound.playTone(1800, 0.2), 300);
      }else{
        this.setTempMessage("密码错误");
        this.state=State.LOCKED_TIMED;
        Sound.warn();
      }
    }else if(this.mode===Mode.NORMAL || this.mode===Mode.PASSWORD){
      if(arrEqual(entered, this.unlockPwd) || arrEqual(entered, MASTER_PW)){
        this.locked=false;
        this.lockEndTime=null;
        this.lockDurationSec=null;
        this.lockStartTime=null;
        this.latchRetracted=true;
        this.state=State.IDLE;
        this.setTempMessage("UNLOCK");
        Sound.playTone(1200, 0.1); setTimeout(()=>Sound.playTone(1500, 0.1), 150); setTimeout(()=>Sound.playTone(1800, 0.2), 300);
      }else{
        this.setTempMessage("密码错误");
        if(this.mode===Mode.NORMAL) this.state=State.LOCKED_TIMED;
        else this.state=State.LOCKED_PASSWORD;
        Sound.warn();
      }
    }
  }

  handleSetLongPress(){
    const now = this.nowSec();

    if(!this.locked && this.state===State.IDLE){
      const oldMode = this.mode;
      this.mode = (this.mode+1)%4;

      if(this.mode===Mode.PASSWORD || this.mode===Mode.INFINITE){
        this.setDays=0; this.setHours=0; this.setMinutes=0;
      }
      if((oldMode===Mode.FORTRESS && this.mode===Mode.NORMAL) ||
         (oldMode===Mode.NORMAL && this.mode===Mode.FORTRESS)){
        this.setDays=0; this.setHours=0; this.setMinutes=0;
      }
      this.setTempMessage("切换模式："+this.modeName);
      Sound.beep();
      return;
    }
    if(this.locked && this.state===State.LOCKED_TIMED && (this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL) && this.lockEndTime){
      const remain = Math.max(0,Math.floor(this.lockEndTime - now));
      this.extendBaseSec = remain;
      const {d,h,m} = secToDHMS(remain);
      this.setDays=d; this.setHours=h; this.setMinutes=m;
      this.state = State.EXTEND_SET;
      this.cursorIdx=0;
      this.bumpInput();
      Sound.beep();
    }
  }

  toggleChildLock(){
    this.childLock = !this.childLock;
    this.setTempMessage(this.childLock ? "儿童锁已开启" : "儿童锁已关闭");
  }

  triggerChildLockBlink(){
    this.childLockBlink = true;
    if(this.childLockBlinkTimer) clearTimeout(this.childLockBlinkTimer);
    this.childLockBlinkTimer = setTimeout(()=>{
      runInAction(()=>{ this.childLockBlink = false; });
    }, 800);
  }

  doFactoryReset(){
    this.mode = Mode.FORTRESS;
    this.state = State.IDLE;
    this.locked=false;
    this.screenOff=false;
    this.childLock=false;

    this.lidClosed=true;
    this.latchRetracted=true;

    this.lockStartTime=null;
    this.setDays=0; this.setHours=0; this.setMinutes=0;
    this.cursorIdx=0;

    this.prelockStart=null;
    this.lockEndTime=null;
    this.lockDurationSec=null;
    this.infiniteStartTime=null;
    this.infiniteDelayEnd=null;
    this.infinitePendingEnd=null;

    this.unlockPwd = [0,0,0,0,0,0,0];
    this.pwDigits = [0,0,0,0,0,0,0];
    this.fortressUsed = [false,false,false,false,false,false];

    this.progressCount=0;
    this.lastCheckinTime=null;

    this.historyTimes = [];
    this.memIndex=0;
    this.setTempMessage("恢复出厂设置");
  }

  onLidToggle(){
    // Allow lid interaction even在熄屏时；仍调用以刷新活动时间/点亮屏。
    this.bumpActivity();
    // When locked (including倒计时解锁阶段), block lid toggling except the special infinite pending window.
    if(this.locked && this.state!==State.INFINITE_PENDING){
      this.setTempMessage("已锁定，无法开盖");
      return;
    }
    this.lidClosed = !this.lidClosed;

    if(this.state===State.PRELOCK){
      if(!this.lidClosed){
        this.prelockStart=null;
        this.setTempMessage("盖子打开，倒计时暂停");
      }else{
        this.prelockStart=this.nowSec();
        this.setTempMessage("重新开始5秒倒计时");
      }
      return;
    }

    if(this.state===State.INFINITE_PENDING && this.latchRetracted && !this.lidClosed){
      this.locked=false;
      this.infiniteStartTime=null;
      this.infiniteDelayEnd=null;
      this.infinitePendingEnd=null;
      this.state=State.IDLE;
      this.setTempMessage("无限模式解锁成功");
      Sound.playTone(1200, 0.1); setTimeout(()=>Sound.playTone(1500, 0.1), 150); setTimeout(()=>Sound.playTone(1800, 0.2), 300);
    }
  }

  // Button Press State Management
  setButtonState(btn: 'set'|'back'|'lock', isDown: boolean){
    const b = this.buttons[btn];
    if(isDown){
      if(!b.isDown){
        b.isDown = true;
        // Sound.playTone(800, 0.05); // Removed button sound
        b.downTime = this.nowSec();
        // When child lock is on, only allow the combo to unlock child mode; block other long-press timers.
        if(this.childLock){
          this.triggerChildLockBlink();
          return;
        }

        if(btn==='set'){
          this.setLongUsed = false;
          if(this.setLongTimer) clearTimeout(this.setLongTimer);
          this.setLongTimer = setTimeout(()=>{
            if(this.buttons.set.isDown && !this.buttons.lock.isDown && !this.buttons.back.isDown){
              this.setLongUsed = true;
              this.bumpActivity();
              this.handleSetLongPress();
            }
          },3000);
        }
      }
    }else{
      if(b.isDown){
        b.isDown = false;
        // When child lock is on, ignore single-button actions; only the combo is allowed to unlock it.
        if(this.childLock){
          this.triggerChildLockBlink();
          return;
        }
        if(btn==='set'){
          if(this.setLongTimer){ clearTimeout(this.setLongTimer); this.setLongTimer=null; }
          if(!this.setLongUsed){
            this.onSetClick();
          }
        }else if(btn==='back'){
          // If the 10s long-press already triggered password change entry, skip the normal back click on release.
          if(!(this.comboChildHandled || this.comboResetHandled || this.back10Handled)){
            this.onBackClick();
          }
        }else if(btn==='lock'){
          if(!(this.comboChildHandled || this.comboResetHandled)){
            this.onLockClick();
          }
        }
      }
    }
  }

  tick(){
    const realNowMs = Date.now();
    const deltaSec = Math.max(0, (realNowMs - this.lastRealTickMs)/1000);
    this.simTimeSec += deltaSec;
    this.lastRealTickMs = realNowMs;
    const now = this.nowSec();

    if(!this.locked && this.progressCount>0 && this.lastCheckinTime!=null){
      if(now - this.lastCheckinTime >= PROGRESS_RESET_SEC){
        this.progressCount = 0;
      }
    }

    if(this.state===State.SET_TIME && now - this.lastInput >= SET_TIME_EXIT_TIMEOUT){
      this.setDays=0; this.setHours=0; this.setMinutes=0;
      this.state = State.IDLE;
      this.lastInput = now;
    }
    if(this.state===State.EXTEND_SET && now - this.lastInput >= EXIT_TIMEOUT){
      this.state = State.LOCKED_TIMED;
      this.lastInput = now;
    }

    if(
      this.state===State.PW_INPUT ||
      this.state===State.PW_MASTER_VERIFY ||
      this.state===State.PW_CHANGE
    ){
      if(now - this.lastActivity >= PW_IDLE_TIMEOUT){
        if(this.state===State.PW_INPUT && this.locked){
          if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL) this.state=State.LOCKED_TIMED;
          else if(this.mode===Mode.PASSWORD) this.state=State.LOCKED_PASSWORD;
          else if(this.mode===Mode.INFINITE) this.state=State.LOCKED_INFINITE;
        }else{
          this.state=State.IDLE;
        }
        this.lastActivity = now;
      }
    }

    // Keep screen awake while any key is held (avoid sleeping during long-press flows like 10s BACK).
    const anyBtnHeld = this.buttons.set.isDown || this.buttons.back.isDown || this.buttons.lock.isDown;
    if(anyBtnHeld) this.lastActivity = now;

    if(!this.screenOff && now-this.lastActivity>=INACTIVITY_SEC){
      this.screenOff=true;
    }

    const sBtn = this.buttons.set;
    const bBtn = this.buttons.back;
    const lBtn = this.buttons.lock;
    const holdSet  = sBtn.isDown ? (now - sBtn.downTime) : 0;
    const holdBack = bBtn.isDown ? (now - bBtn.downTime) : 0;
    const holdLock = lBtn.isDown ? (now - lBtn.downTime) : 0;

    // If child lock is enabled, only allow the BACK+LOCK 5s combo to toggle it; block other combos/long-press actions.
    if(this.childLock){
      if(bBtn.isDown && lBtn.isDown && holdBack>=5 && holdLock>=5 && !this.comboChildHandled && !this.comboResetHandled){
        this.comboChildHandled=true;
        this.toggleChildLock();
      }
      if(!bBtn.isDown) this.back10Handled=false;
      if(!bBtn.isDown) this.comboChildHandled=false;
      if(!sBtn.isDown || !lBtn.isDown) this.comboResetHandled=false;
    }else{
      if(sBtn.isDown && lBtn.isDown && holdSet>=20 && holdLock>=20 && !this.comboResetHandled){
        this.comboResetHandled=true;
        this.doFactoryReset();
      }
      if(bBtn.isDown && lBtn.isDown && holdBack>=5 && holdLock>=5 && !this.comboChildHandled && !this.comboResetHandled){
        this.comboChildHandled=true;
        this.toggleChildLock();
      }
      if(bBtn.isDown && !lBtn.isDown && !sBtn.isDown &&
         holdBack>=10 && !this.back10Handled && !this.locked && this.state===State.IDLE){
        this.back10Handled=true;
        this.bumpActivity();
        this.pwDigits=[0,0,0,0,0,0,0];
        this.cursorIdx=0;
        this.state=State.PW_MASTER_VERIFY;
        this.setTempMessage("进入密码设置");
      }

      if(!bBtn.isDown) this.back10Handled=false;
      if(!bBtn.isDown) this.comboChildHandled=false;
      if(!sBtn.isDown || !lBtn.isDown) this.comboResetHandled=false;
    }

    if(this.state===State.PRELOCK){
      if(!this.lidClosed){
        this.prelockStart=null;
      }else if(this.prelockStart!=null){
        const elapsed = Math.floor(now-this.prelockStart);
        if(elapsed>=ARM_COUNTDOWN){
          this.locked=true;
          this.latchRetracted=false;
          this.lockStartTime = now;
          if(this.mode===Mode.FORTRESS || this.mode===Mode.NORMAL){
            const total = dhmToSec(this.setDays,this.setHours,this.setMinutes);
            this.lockEndTime = now+total;
            this.lockDurationSec = total;
            this.addHistory(total);
            this.state=State.LOCKED_TIMED;
          }else if(this.mode===Mode.PASSWORD){
            this.lockEndTime=null; this.lockDurationSec=null;
            this.state=State.LOCKED_PASSWORD;
          }else if(this.mode===Mode.INFINITE){
            this.lockEndTime=null; this.lockDurationSec=null;
            this.infiniteStartTime=now;
            this.state=State.LOCKED_INFINITE;
          }
          this.prelockStart=null;
          Sound.doubleBeep();
        }
      }
    }

    if(this.state===State.LOCKED_TIMED && this.lockEndTime){
      if(now>=this.lockEndTime){
        if(this.mode===Mode.FORTRESS){
          this.handle21OnAutoUnlock(now, false);
        }
        this.locked=false;
        this.latchRetracted=true;
        this.lockEndTime=null;
        this.lockDurationSec=null;
        this.lockStartTime=null;
        this.state=State.IDLE;
        Sound.playTone(1200, 0.1); setTimeout(()=>Sound.playTone(1500, 0.1), 150); setTimeout(()=>Sound.playTone(1800, 0.2), 300);
      }
    }

    if(this.state===State.INFINITE_DELAY && this.infiniteDelayEnd){
      if(now>=this.infiniteDelayEnd){
        this.state=State.INFINITE_PENDING;
        this.infinitePendingEnd = now+INFINITE_PENDING_SEC;
        this.latchRetracted=true;
      }
    }
    if(this.state===State.INFINITE_PENDING && this.infinitePendingEnd){
      if(now>=this.infinitePendingEnd){
        this.state=State.LOCKED_INFINITE;
        this.infiniteDelayEnd=null;
        this.infinitePendingEnd=null;
        this.latchRetracted=false;
      }
    }
  }

  // Debug Actions
  debugReduceTime(seconds: number){
    if(this.lockEndTime){
      this.lockEndTime = Math.min(this.lockEndTime, this.nowSec() + seconds);
    }
  }

  debugFastForward(seconds: number){
    // Advance simulated clock forward; timers and progress will process on the next tick.
    this.simTimeSec += seconds;
    this.tick();
  }
  debugUnlock(){
    this.locked=false;
    this.state=State.IDLE;
    this.latchRetracted=true;
    this.lockStartTime=null;
  }
}

export const timerStore = new TimerStore();
