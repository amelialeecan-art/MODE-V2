import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard, SectionHeader, Chip, ChipGroup } from '@/design'
import { useData, useAsyncData } from '@/app/DataContext'
import { exportBackup, importBackup, type BackupFile } from '@/data/importExport/backup'
import type { ToneMode } from '@/domain/settings/settings'
import './settings.css'

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`toggle${on ? ' toggle--on' : ''}`} onClick={() => onChange(!on)}>
      <span className="toggle__knob" />
    </button>
  )
}

const TONE_OPTIONS: { value: ToneMode; label: string }[] = [
  { value: 'banmal', label: '반말' },
  { value: 'haeyo', label: '해요체' },
]

export function SettingsScreen() {
  const { repos, settings, saveSettings, bump, version } = useData()
  const nav = useNavigate()
  const [msg, setMsg] = useState<string | null>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const { data: meta } = useAsyncData(() => repos.getMeta(), [repos, version])

  async function doExport() {
    const file = await exportBackup(repos)
    downloadJson(`mode-backup-${file.exportedAt.slice(0, 10)}.json`, file)
    bump()
    setMsg('백업 파일을 내려받았어.')
  }

  async function onBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const file = JSON.parse(await f.text()) as BackupFile
    const r = await importBackup(repos, file, { replace: true })
    bump()
    const total = Object.values(r.imported).reduce((a, b) => a + b, 0)
    setMsg(`백업 복원 완료 — ${total}건`)
    e.target.value = ''
  }

  const lastBackup = meta?.lastBackupAt ? new Date(meta.lastBackupAt).toLocaleString('ko-KR') : '없음'

  return (
    <div className="screen">
      <header className="screen-head settings-head">
        <button className="settings-back" aria-label="뒤로" onClick={() => nav('/')}>‹</button>
        <h1 className="screen-head__title">설정</h1>
      </header>

      {/* 말투 */}
      <GlassCard>
        <SectionHeader title="말투" subtitle="앱이 말 거는 톤을 골라" />
        <div style={{ marginTop: 12 }}>
          <ChipGroup label="말투">
            {TONE_OPTIONS.map((t) => (
              <Chip key={t.value} label={t.label} tone="lav" selected={settings.toneMode === t.value}
                onToggle={() => saveSettings({ ...settings, toneMode: t.value })} />
            ))}
          </ChipGroup>
        </div>
        <p className="setting-hint">{settings.toneMode === 'banmal' ? '앱 전체 문구가 반말로 나와.' : '앱 전체 문구가 해요체로 나와요.'}</p>
      </GlassCard>

      {/* 생리 주기 */}
      <GlassCard>
        <SectionHeader title="생리 주기" subtitle="주기 구간 계산에 사용돼" />
        <div className="setting-row">
          <span className="setting-row__label">생리 기록·주기 분석 사용</span>
          <Toggle on={settings.cycleEnabled} onChange={(v) => saveSettings({ ...settings, cycleEnabled: v })} label="생리 기록·주기 분석 사용" />
        </div>
        <p className="setting-hint">생리는 사실만 기록하고, 주기 구간은 실제 기록한 날짜로만 계산해. 28일 평균 같은 가정은 쓰지 않아.</p>
      </GlassCard>

      {/* 데이터 */}
      <GlassCard tint="mint">
        <SectionHeader title="데이터" subtitle="내 기록 관리 · 이 기기에만 저장돼" />
        <p className="setting-hint" style={{ marginTop: 2 }}>오래 쌓인 원자료가 가치야. 그 파일만으로 완전히 복원돼. 서버로 보내지 않아.</p>
        <button className="data-btn" onClick={doExport}>JSON 내보내기</button>
        <button className="data-btn" onClick={() => backupRef.current?.click()}>JSON 불러오기 (전체 교체)</button>
        <input ref={backupRef} type="file" accept="application/json,.json" className="import-file-input" onChange={onBackupFile} />
        <p className="setting-hint setting-hint--soft">마지막 백업: {lastBackup}</p>
        {msg && <p className="settings-msg">{msg}</p>}
      </GlassCard>

      {/* 앱 정보 */}
      <GlassCard>
        <SectionHeader title="앱 정보" />
        <div className="setting-row">
          <span className="setting-row__label">데이터 형식</span>
          <span className="setting-hint" style={{ margin: 0 }}>schema v{meta?.schemaVersion ?? '—'} · migration v{meta?.migrationVersion ?? '—'}</span>
        </div>
      </GlassCard>

      <p className="settings-foot">MODE · 개인 시계열 기록</p>
    </div>
  )
}
