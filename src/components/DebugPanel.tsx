import React from 'react';
import { observer } from 'mobx-react-lite';
import { timerStore, State, Mode } from '../store/TimerStore';

export const DebugPanel = observer(() => {
  const { state, mode, fortressPw, unlockPwd, setDays, setHours, setMinutes, lidClosed, lockEndTime } = timerStore;

  let remainingTime = "无";
  if (lockEndTime) {
    const now = Date.now() / 1000;
    const diff = Math.max(0, Math.floor(lockEndTime - now));
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    remainingTime = `${d}天 ${h}时 ${m}分 ${s}秒`;
  }

  return (
    <div className="debug-container">
      <div className="debug-panel">
        <h3>调试控制</h3>
        <div className="debug-info">
          <div>模式: {Mode[mode]}</div>
          <div>状态: {State[state]}</div>
          <div>设定时间: {setDays}天 {setHours}时 {setMinutes}分</div>
          <div>锁定剩余: {remainingTime}</div>
          <div>盖子状态: {lidClosed ? "已合上" : "已打开"}</div>
          <div>主密码: 6666666</div>
          <div>解锁密码: {unlockPwd.join('')}</div>
        </div>
        <div className="debug-buttons">
          <button onClick={() => timerStore.onLidToggle()}>
            {lidClosed ? "打开盖子" : "合上盖子"}
          </button>
          <button onClick={() => timerStore.debugReduceTime(5)}>设置锁定剩余5秒</button>
          <button onClick={() => timerStore.debugUnlock()}>强制解锁</button>
          <button onClick={() => timerStore.doFactoryReset()}>恢复出厂设置</button>
          <button onClick={() => timerStore.toggleChildLock()}>切换儿童锁</button>
        </div>
      </div>
      
      <div className="intro-panel">
        <div className="intro-section">
          <h4>基础按键</h4>
          <ul>
            <li><strong>SET (设置):</strong> 短按切换光标位置（天/时/分）；长按3秒切换模式。</li>
            <li><strong>UP/DOWN (上/下):</strong> 调整时间数值；在主界面查看历史记录。</li>
            <li><strong>LOCK (锁定):</strong> 确认设置并开始锁定；双击快速锁定（密码/无限模式）。</li>
            <li><strong>BACK (返回):</strong> 返回上一级；取消当前操作。</li>
          </ul>
        </div>

        <div className="intro-section">
          <h4>组合键 & 特殊功能</h4>
          <ul>
            <li><strong>切换模式:</strong> 非锁定状态下，长按 <strong>SET</strong> 键。</li>
            <li><strong>儿童锁:</strong> 同时按住 <strong>BACK + LOCK</strong> 5秒（屏幕显示笑脸）。</li>
            <li><strong>恢复出厂:</strong> 同时按住 <strong>SET + LOCK</strong> 20秒。</li>
            <li><strong>修改密码:</strong> 待机时长按 <strong>BACK</strong> 10秒进入主密码验证（默认6666666）。</li>
          </ul>
        </div>

        <div className="intro-section">
          <h4>模式说明</h4>
          <ul>
            <li><strong>堡垒模式:</strong> 严格锁定，无法中途修改时间，仅可通过紧急密码解锁。</li>
            <li><strong>普通模式:</strong> 可随时使用解锁密码解锁。</li>
            <li><strong>密码模式:</strong> 不设时间，锁定后需密码解锁。</li>
            <li><strong>无限模式:</strong> 锁定后计时，直到手动结束（有延时确认）。</li>
          </ul>
        </div>
      </div>
    </div>
  );
});
