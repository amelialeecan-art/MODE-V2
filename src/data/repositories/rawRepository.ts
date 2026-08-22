/* =====================================================================
   raw store 공통 repository 팩토리.
   - input(provenance 없는) 을 받아 schemaVersion/createdAt/updatedAt 를 찍어 저장.
   - bulkImport 는 완성된 record 를 그대로 넣는다(migration/import 용).
   - 단일 방향: 여기 위(analysis/features)에서만 호출. V1 우회 없음.
   ===================================================================== */
import type { Table } from 'dexie'
import { SCHEMA_VERSION } from '@/domain/common/types'
import { nowISO } from '@/shared/time/time'

interface Stamped {
  id?: number
  schemaVersion: number
  createdAt: string
  updatedAt: string
  localDate?: string
}

export class RawRepository<TRecord extends Stamped, TInput> {
  constructor(private readonly table: Table<TRecord, number>) {}

  /** 신규/수정 저장. id 없으면 add, 있으면 update. provenance stamp. */
  async put(input: TInput & { id?: number }): Promise<number> {
    const now = nowISO()
    if (input.id != null) {
      const existing = await this.table.get(input.id)
      const merged = {
        ...(existing as object),
        ...(input as object),
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now,
      } as unknown as TRecord
      await this.table.put(merged)
      return input.id
    }
    const record = {
      ...(input as object),
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    } as unknown as TRecord
    return this.table.add(record)
  }

  /** 완성된 record 를 그대로 대량 삽입(migration/import). */
  async bulkImport(records: TRecord[]): Promise<void> {
    if (records.length === 0) return
    await this.table.bulkAdd(records)
  }

  get(id: number): Promise<TRecord | undefined> {
    return this.table.get(id)
  }

  all(): Promise<TRecord[]> {
    return this.table.toArray()
  }

  count(): Promise<number> {
    return this.table.count()
  }

  async delete(id: number): Promise<void> {
    await this.table.delete(id)
  }

  async clear(): Promise<void> {
    await this.table.clear()
  }

  /** localDate 인덱스가 있는 store 에서 특정 날짜 조회. */
  byDate(localDate: string): Promise<TRecord[]> {
    return this.table.where('localDate').equals(localDate).toArray()
  }

  /** [from, to] localDate 범위(포함). */
  inRange(from: string, to: string): Promise<TRecord[]> {
    return this.table.where('localDate').between(from, to, true, true).toArray()
  }
}
