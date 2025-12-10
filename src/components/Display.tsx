import React from 'react';
import { observer } from 'mobx-react-lite';
import { timerStore, Mode, State } from '../store/TimerStore';
import clsx from 'clsx';

function secToDHMS(sec: number) {
  if (sec < 0) sec = 0;
  let d = Math.floor(sec / 86400); sec %= 86400;
  let h = Math.floor(sec / 3600);  sec %= 3600;
  let m = Math.floor(sec / 60);
  let s = sec % 60;
  return { d, h, m, s };
}

export const Display = observer(() => {
  const store = timerStore;
  const {
    mode, state, locked, screenOff, childLock,
    setDays, setHours, setMinutes, cursorIdx,
    pwDigits, prelockStart, lockEndTime,
    infiniteStartTime, infiniteDelayEnd, infinitePendingEnd,
    progressCount, lidClosed, isFlashingReward, tempMessage
  } = store;

  // Force re-render for countdowns
  const [_, setTick] = React.useState(0);
  const [phoneInside, setPhoneInside] = React.useState(false);
  React.useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 200);
    return () => clearInterval(timer);
  }, []);

  const hideOuterPhone = phoneInside && lidClosed;

  const handlePhoneClick = () => {
    if (phoneInside) {
      if (!locked && !lidClosed) {
        setPhoneInside(false);
      }
      return;
    }
    if (lidClosed) {
      store.setTempMessage("请先打开盖子再放入手机");
      return;
    }
    setPhoneInside(true);
  };

  const handleLidClick = () => {
    if (locked && state !== State.INFINITE_PENDING) {
      store.setTempMessage("已锁定，无法开盖");
      return;
    }
    store.onLidToggle();
  };

  // Derived state for display
  let topText = "";
  let infoLine = "";
  let dStr = "---";
  let hStr = "--";
  let mStr = "--";
  let sStr = "00";
  let showCursor = false;
  let showSecsLabel = false;
  const modeName = store.modeName;

  if (state === State.IDLE) {
    topText = modeName + " READY";
    infoLine = "SET 设置时间（堡垒/普通），LOCK 开始锁定";
    dStr = String(setDays).padStart(3, "0");
    hStr = String(setHours).padStart(2, "0");
    mStr = String(setMinutes).padStart(2, "0");
    sStr = "00";
  }
  else if (state === State.SET_TIME) {
    topText = modeName + " SET TIME";
    infoLine = "SET 换位，上/下改时间，BACK 返回";
    dStr = String(setDays).padStart(3, "0");
    hStr = String(setHours).padStart(2, "0");
    mStr = String(setMinutes).padStart(2, "0");
    sStr = "00";
    showCursor = true;
  }
  else if (state === State.MEM_RECALL) {
    topText = modeName + " 记忆";
    infoLine = "上/下选择历史时长，LOCK 确认，BACK 返回";
    dStr = String(setDays).padStart(3, "0");
    hStr = String(setHours).padStart(2, "0");
    mStr = String(setMinutes).padStart(2, "0");
    sStr = "00";
  }
  else if (state === State.PRELOCK) {
    topText = modeName + " ARMING";
    infoLine = lidClosed ? "5 秒后上锁，BACK 可取消" : "盖子打开，等待重新合上";

    let left = 5;
    if (lidClosed && prelockStart != null) {
      left = Math.max(0, 5 - Math.floor(Date.now() / 1000 - prelockStart));
    }
    dStr = "---";
    hStr = "--";
    mStr = "--";
    sStr = String(left).padStart(2, "0");
    showSecsLabel = true;
  }
  else if (state === State.LOCKED_TIMED) {
    topText = modeName + " LOCKED";
    infoLine = "双击返回 → 紧急解锁 / 长按 SET 延长";

    let leftSec = 0;
    if (lockEndTime != null) {
      leftSec = Math.max(0, Math.floor(lockEndTime - Date.now() / 1000));
    }
    const { d, h, m, s } = secToDHMS(leftSec);

    dStr = String(d).padStart(3, "0");
    hStr = String(h).padStart(2, "0");
    mStr = String(m).padStart(2, "0");
    sStr = String(s).padStart(2, "0");
  }
  else if (state === State.LOCKED_PASSWORD) {
    topText = modeName + " LOCKED";
    infoLine = "双击返回 → 输入密码解锁";
    dStr = "---";
    hStr = "--";
    mStr = "--";
    sStr = "00";
  }
  else if (state === State.LOCKED_INFINITE) {
    topText = modeName + " LOCKED";
    infoLine = "双击返回 → 进入解锁延时";
    let elapsed = 0;
    if (infiniteStartTime != null) {
      elapsed = Math.max(0, Math.floor(Date.now() / 1000 - infiniteStartTime));
    }
    const { d, h, m, s } = secToDHMS(elapsed);
    dStr = String(d).padStart(3, "0");
    hStr = String(h).padStart(2, "0");
    mStr = String(m).padStart(2, "0");
    sStr = String(s).padStart(2, "0");
  }
  else if (state === State.PW_INPUT) {
    topText = modeName + " PW INPUT";
    infoLine = "SET 换位，上/下改数字，LOCK 确认";
    const s = pwDigits.join("");
    dStr = s.slice(0, 3);
    hStr = s.slice(3, 5);
    mStr = s.slice(5, 7);
    sStr = "00";
    showCursor = true;
  }
  else if (state === State.INFINITE_DELAY) {
    topText = modeName + " DELAY";
    infoLine = "解锁延时中，BACK 取消";
    let left = 0;
    if (infiniteDelayEnd != null) {
      left = Math.max(0, Math.floor(infiniteDelayEnd - Date.now() / 1000));
    }
    const { d, h, m, s } = secToDHMS(left);
    dStr = String(d).padStart(3, "0");
    hStr = String(h).padStart(2, "0");
    mStr = String(m).padStart(2, "0");
    sStr = String(s).padStart(2, "0");
  }
  else if (state === State.INFINITE_PENDING) {
    topText = modeName + " 待解锁";
    infoLine = "5 分钟内打开盖子完成解锁";
    let left = 0;
    if (infinitePendingEnd != null) {
      left = Math.max(0, Math.floor(infinitePendingEnd - Date.now() / 1000));
    }
    const { d, h, m, s } = secToDHMS(left);
    dStr = String(d).padStart(3, "0");
    hStr = String(h).padStart(2, "0");
    mStr = String(m).padStart(2, "0");
    sStr = String(s).padStart(2, "0");
  }
  else if (state === State.EXTEND_SET) {
    topText = modeName + " EXTEND";
    infoLine = "SET 换位，上/下改时间，LOCK 确认延长";
    dStr = String(setDays).padStart(3, "0");
    hStr = String(setHours).padStart(2, "0");
    mStr = String(setMinutes).padStart(2, "0");
    sStr = "00";
    showCursor = true;
  }
  else if (state === State.PW_MASTER_VERIFY) {
    topText = modeName + " 主密码";
    infoLine = "输入主密码，LOCK 确认，BACK 退出";
    const s = pwDigits.join("");
    dStr = s.slice(0, 3);
    hStr = s.slice(3, 5);
    mStr = s.slice(5, 7);
    sStr = "00";
    showCursor = true;
  }
  else if (state === State.PW_CHANGE) {
    topText = modeName + " 改解锁密码";
    infoLine = "SET 换位，上/下改数字，LOCK 保存";
    const s = pwDigits.join("");
    dStr = s.slice(0, 3);
    hStr = s.slice(3, 5);
    mStr = s.slice(5, 7);
    sStr = "00";
    showCursor = true;
  }

  if (childLock) {
    topText = modeName + " 儿童锁";
  }

  if (tempMessage) {
    infoLine = tempMessage;
  }

  // Icons
  const icShield = mode === Mode.FORTRESS;
  const icKey = mode === Mode.PASSWORD;
  const icInf = mode === Mode.INFINITE;
  const icSmile = childLock;
  const icSmileBlink = childLock && store.childLockBlink;
  const icGear = state === State.PW_MASTER_VERIFY || state === State.PW_CHANGE;

  const blinkInf = mode === Mode.INFINITE && state === State.INFINITE_DELAY;
  const blinkLock = state === State.INFINITE_PENDING || store.warnLockIcon;

  const sceneClasses = clsx("box-scene", {
    "lid-open": !lidClosed,
    "lid-closed": lidClosed,
    locked
  });

  return (
    <div className="display-wrapper">
      <div className={clsx("display-container", { "screen-off": screenOff, "flashing": isFlashingReward })}>
        <div className="status-bar">
          <div className="status-icons">
            <div className={clsx("icon", {active: icGear})}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
            </div>
            <div className={clsx("icon", {active: icSmile, blink: icSmileBlink})}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            </div>
            <div className={clsx("icon", {active: icInf, blink: blinkInf})}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 4c-2.67 0-4.94 1.64-5.93 4.03C8.13 5.92 6.21 4.5 4 4.5 1.79 4.5 0 6.29 0 8.5c0 2.21 1.79 4 4 4 2.21 0 4.13-1.42 5.07-3.53C10.06 11.08 12.33 12.5 15 12.5c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM4 10.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" transform="translate(2, 4)"/></svg>
            </div>
            <div className={clsx("icon", {active: icKey})}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
            </div>
            <div className={clsx("icon", {active: icShield})}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
            </div>
          </div>
          <div className="status-icons">
            <div className="icon active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z M13 18h-2v-2h2v2zm0-4h-2V9h2v5z"/></svg>
            </div>
            <div id="icon-lock" className={clsx("icon active", {blink: blinkLock})}>
              {locked ?
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> :
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>
              }
            </div>
          </div>
        </div>

        <div className="main-time">
          <div className="digit-group">
            <div className="digits-row">
              <div className="digit-wrapper">
                <span className="digits">{dStr[0]}</span>
                {showCursor && cursorIdx === 0 && <div className="cursor-line"></div>}
              </div>
              <div className="digit-wrapper">
                <span className="digits">{dStr[1]}</span>
                {showCursor && cursorIdx === 1 && <div className="cursor-line"></div>}
              </div>
              <div className="digit-wrapper">
                <span className="digits">{dStr[2]}</span>
                {showCursor && cursorIdx === 2 && <div className="cursor-line"></div>}
              </div>
            </div>
            <span className="unit-label">DAYS</span>
          </div>

          <span className="separator">:</span>

          <div className="digit-group">
            <div className="digits-row">
              <div className="digit-wrapper">
                <span className="digits">{hStr[0]}</span>
                {showCursor && cursorIdx === 3 && <div className="cursor-line"></div>}
              </div>
              <div className="digit-wrapper">
                <span className="digits">{hStr[1]}</span>
                {showCursor && cursorIdx === 4 && <div className="cursor-line"></div>}
              </div>
            </div>
            <span className="unit-label">HOURS</span>
          </div>

          <span className="separator">:</span>

          <div className="digit-group">
            <div className="digits-row">
              <div className="digit-wrapper">
                <span className="digits">{mStr[0]}</span>
                {showCursor && cursorIdx === 5 && <div className="cursor-line"></div>}
              </div>
              <div className="digit-wrapper">
                <span className="digits">{mStr[1]}</span>
                {showCursor && cursorIdx === 6 && <div className="cursor-line"></div>}
              </div>
            </div>
            <span className="unit-label">{showSecsLabel ? "SECS" : "MINS"}</span>
          </div>

          <div className="seconds-inline">
            <span className="seconds-separator">:</span>
            <span className="seconds-digits">{sStr}</span>
          </div>
        </div>

        <div className="message-text">{infoLine}</div>

        <div className="progress-section">
          <div className="progress-bar">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                className={clsx("progress-segment", { filled: i < progressCount })}
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className={sceneClasses}>
        <div className={clsx("animated-box", { open: !lidClosed, closed: lidClosed, locked })}>
          <button
            className="box-lid"
            onClick={handleLidClick}
            aria-label={lidClosed ? "open lid" : "close lid"}
          >
            <div className="lid-screen">
              <div className="mini-display">
                <div className="mini-top">{topText}</div>
                <div className="mini-digits">
                  <span className="mini-digit">{dStr}</span>
                  <span className="mini-colon">:</span>
                  <span className="mini-digit">{hStr}</span>
                  <span className="mini-colon">:</span>
                  <span className="mini-digit">{mStr}</span>
                  <span className="mini-seconds">:{sStr}</span>
                </div>
                <div className="mini-info">{infoLine}</div>
              </div>
            </div>
          </button>
          <div className="box-body">
            <div className="box-inner">
              <div className="box-floor"></div>
              <div className={clsx("box-phone-inside", { visible: phoneInside, hidden: !phoneInside })}></div>
            </div>
          </div>
        </div>

        <div
          className={clsx("scene-phone", phoneInside ? "inside" : "outside", { locked, hidden: hideOuterPhone })}
          onClick={handlePhoneClick}
          role="button"
          aria-label="phone-toggle"
        >
          <div className="phone-screen"></div>
          <div className="phone-btn"></div>
        </div>
      </div>
    </div>
  );
});
