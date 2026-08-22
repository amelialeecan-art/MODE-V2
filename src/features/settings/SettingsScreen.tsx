import { useRef, useState } from 'react'
import { Card, Segmented, Button } from '@/shared/ui/primitives'
import { useData, useAsyncData } from '@/app/DataContext'
import { exportBackup, importBackup, type BackupFile } from '@/data/importExport/backup'
import { importLegacyExport } from '@/data/migrations/runMigration'
import type { LegacyExport } from '@/data/migrations/legacyTypes'
import type { ToneMode } from '@/domain/settings/settings'

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsScreen() {
  const { repos, settings, saveSettings, bump, version } = useData()
  const [msg, setMsg] = useState<string | null>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const legacyRef = useRef<HTMLInputElement>(null)

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

  async function onLegacyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const legacy = JSON.parse(await f.text()) as LegacyExport
    const report = await importLegacyExport(repos, legacy)
    bump()
    const c = report.counts
    const skipped = report.skippedByV2Conflict.state + report.skippedByV2Conflict.sleep + report.skippedByV2Conflict.cycle
    const conflictNote = skipped > 0 ? ` · 같은 날 직접입력 우선으로 ${skipped}건 건너뜀` : ''
    setMsg(`구 MODE 데이터 가져오기 완료 — 상태 ${c.state} · 수면 ${c.sleep} · 식사 ${c.meal} · 생리 ${c.cycle} · 맥락 ${c.context} · 한 일 ${c.recovery} (계산 결과는 버림${conflictNote})`)
    e.target.value = ''
  }

  async function reset() {
    if (!confirm('모든 기록을 지울까? 되돌릴 수 없어. 먼저 백업을 권장해.')) return
    await repos.clearAllData()
    bump()
    setMsg('모든 기록을 지웠어.')
  }

  return (
    <div className="screen">
      <h1 className="screen__title">⚙ 설정</h1>

      <div className="section-label">말투</div>
      <Card>
        <Segmented<ToneMode>
          options={[{ value: 'banmal', label: '반말' }, { value: 'haeyo', label: '해요체' }]}
          value={settings.toneMode}
          onChange={(v) => saveSettings({ ...settings, toneMode: v })}
        />
        <p className="tiny dim" style={{ marginTop: 8 }}>
          {settings.toneMode === 'banmal' ? '앱 전체 문구가 반말로 나와.' : '앱 전체 문구가 해요체로 나와요.'}
        </p>
      </Card>

      <div className="section-label">생리 기능</div>
      <Card>
        <div className="row-between">
          <span>생리 기록·주기 분석 사용</span>
          <Button variant={settings.cycleEnabled ? 'primary' : 'ghost'} onClick={() => saveSettings({ ...settings, cycleEnabled: !settings.cycleEnabled })}>
            {settings.cycleEnabled ? '켜짐' : '꺼짐'}
          </Button>
        </div>
      </Card>

      <div className="section-label">데이터 백업</div>
      <Card>
        <p className="tiny muted" style={{ marginBottom: 10 }}>
          이 앱은 오래 쌓인 기록이 가치야. 원자료 중심으로 내보내고, 그 파일만으로 완전히 복원돼.
        </p>
        <div className="stack">
          <Button block variant="primary" onClick={doExport}>JSON 내보내기</Button>
          <Button block variant="ghost" onClick={() => backupRef.current?.click()}>JSON 불러오기(전체 교체)</Button>
        </div>
        <input ref={backupRef} type="file" accept="application/json" hidden onChange={onBackupFile} />
        {meta && (
          <p className="tiny dim" style={{ marginTop: 10 }}>
            마지막 백업: {meta.lastBackupAt ? new Date(meta.lastBackupAt).toLocaleString('ko-KR') : '없음'} · schema v{meta.schemaVersion} · migration v{meta.migrationVersion}
          </p>
        )}
      </Card>

      <div className="section-label">구 MODE 데이터 가져오기</div>
      <Card>
        <p className="tiny muted" style={{ marginBottom: 10 }}>
          예전 MODE의 export JSON을 한 번 변환해서 가져와. 계산된 점수·패턴은 버리고 원자료만 살려.
        </p>
        <Button block variant="ghost" onClick={() => legacyRef.current?.click()}>구 export 파일 선택</Button>
        <input ref={legacyRef} type="file" accept="application/json" hidden onChange={onLegacyFile} />
      </Card>

      <div className="section-label">위험 구역</div>
      <Card>
        <Button block variant="ghost" onClick={reset}>모든 기록 지우기</Button>
      </Card>

      {msg && <Card><p className="tiny">{msg}</p></Card>}

      <p className="tiny dim" style={{ marginTop: 18, textAlign: 'center' }}>MODE · 개인 시계열 기록</p>
    </div>
  )
}
