import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { repositories, type Repositories } from '@/data/repositories'
import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/settings/settings'
import { makeTone, type Tone } from '@/copy/tone'

interface DataContextValue {
  repos: Repositories
  settings: AppSettings
  tone: Tone
  /** 쓰기 후 read surface 재조회를 유발. */
  version: number
  bump: () => void
  saveSettings: (s: AppSettings) => Promise<void>
  ready: boolean
}

const Ctx = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    repositories.getMeta().then((m) => {
      setSettings(m.settings)
      setReady(true)
    })
  }, [])

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const saveSettings = useCallback(async (s: AppSettings) => {
    await repositories.saveSettings(s)
    setSettings(s)
    setVersion((v) => v + 1)
  }, [])

  const tone = useMemo(() => makeTone(settings.toneMode), [settings.toneMode])

  const value = useMemo<DataContextValue>(
    () => ({ repos: repositories, settings, tone, version, bump, saveSettings, ready }),
    [settings, tone, version, bump, saveSettings, ready],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData must be used within DataProvider')
  return v
}

/** version/deps 변화 시 async 로더 재실행. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    loader().then((d) => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, reload }
}
