import assert from 'node:assert/strict'
import { test } from 'node:test'
import JSZip from 'jszip'
import { downloadPostsArchive, readBackupArchive } from '../src/services/backupService.js'

test('selected post ZIPs use date folders and can be restored', async () => {
  const downloads = []
  const blobs = new Map()
  const originalDocument = globalThis.document
  const originalWindow = globalThis.window
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  let nextUrl = 0

  globalThis.document = {
    body: { append() {} },
    createElement() {
      return {
        style: {},
        click() {
          downloads.push({ filename: this.download, blob: blobs.get(this.href) })
        },
        remove() {},
      }
    },
  }
  globalThis.window = { setTimeout() {} }
  URL.createObjectURL = (blob) => {
    const url = `blob:test-${nextUrl += 1}`
    blobs.set(url, blob)
    return url
  }
  URL.revokeObjectURL = () => {}

  try {
    await downloadPostsArchive([{
      id: 'post-123',
      text: 'A locally saved post',
      image: null,
      createdAt: '2026-03-04T05:06:07.000Z',
      syncStatus: 'local-only',
    }])

    assert.equal(downloads.length, 1)
    assert.match(downloads[0].filename, /^omaara-posts_.*_part-001\.zip$/)
    const zip = await JSZip.loadAsync(downloads[0].blob)
    assert.ok(zip.file('posts/2026/03/04/20260304T050607Z-post-123.json'))

    const restored = await readBackupArchive(downloads[0].blob)
    assert.equal(restored.posts.length, 1)
    assert.equal(restored.posts[0].id, 'post-123')
  } finally {
    globalThis.document = originalDocument
    globalThis.window = originalWindow
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})

test('archive import rejects ZIP files above the per-file limit', async () => {
  await assert.rejects(
    readBackupArchive({ size: 387_000_001 }),
    /387 MB or smaller/,
  )
})

test('archive import rejects unrelated ZIP formats', async () => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ format: 'unrelated', version: 1 }))
  const blob = await zip.generateAsync({ type: 'blob' })
  await assert.rejects(readBackupArchive(blob), /not a supported Omaara backup/)
})
