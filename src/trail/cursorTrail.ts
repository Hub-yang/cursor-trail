/**
 * cursorTrail.ts
 *
 * 光标拖尾动画逻辑，移植自：
 * https://github.com/qwreey/dotfiles/tree/master/vscode/trailCursorEffect
 *
 * 此文件由 scriptBuilder.ts 编译为独立字符串，内联注入到 workbench.html。
 * 严禁在此文件中 import 任何模块——运行环境是 VSCode 渲染进程，没有模块系统。
 *
 * 配置常量（TRAIL_COLOR、CURSOR_STYLE、TRAIL_LENGTH 等）由
 * scriptBuilder 在 IIFE 包裹器之前动态注入到代码头部。
 */

// ─── 类型声明（仅编译期使用，esbuild 打包时会被抹除）────────────────────────────

declare const TRAIL_COLOR: string
declare const CURSOR_STYLE: 'line' | 'block'
declare const TRAIL_LENGTH: number
declare const CURSOR_UPDATE_POLLING_RATE: number
declare const USE_SHADOW: boolean
declare const SHADOW_COLOR: string
declare const SHADOW_BLUR: number

// ─── createTrail：Canvas 粒子绘制模块 ─────────────────────────────────────────

interface TrailOptions {
  length: number
  color: string
  style: 'line' | 'block'
  canvas: HTMLCanvasElement
  size?: number
  sizeY?: number
  useShadow?: boolean
  shadowColor?: string
  shadowBlur?: number
}

interface TrailHandle {
  updateParticles: () => void
  move: (x: number, y: number) => void
  updateSize: (w: number, h: number) => void
  updateCursorSize: (w: number, h: number) => void
}

function createTrail(options: TrailOptions): TrailHandle {
  const totalParticles = options.length ?? 20
  const particlesColor = options.color ?? '#A052FF'
  const style = options.style ?? 'block'
  const canvas = options.canvas
  const context = canvas.getContext('2d')!
  const useShadow = options.useShadow ?? false
  const shadowColor = options.shadowColor ?? particlesColor
  const shadowBlur = options.shadowBlur ?? 15

  const cursor = { x: 0, y: 0 }
  const particles: Array<{ position: { x: number, y: number } }> = []
  let width = 0
  let height = 0
  let sizeX = options.size ?? 3
  let sizeY = options.sizeY ?? sizeX * 2.2
  let cursorsInitted = false

  function updateSize(x: number, y: number) {
    width = x
    height = y
    canvas.width = x
    canvas.height = y
  }

  function move(x: number, y: number) {
    x = x + sizeX / 2
    cursor.x = x
    cursor.y = y
    if (!cursorsInitted) {
      cursorsInitted = true
      for (let i = 0; i < totalParticles; i++) {
        particles.push({ position: { x, y } })
      }
    }
  }

  function calculatePosition() {
    let x = cursor.x
    let y = cursor.y
    for (let i = 0; i < particles.length; i++) {
      const next = (particles[i + 1] ?? particles[0]).position
      const pos = particles[i].position
      pos.x = x
      pos.y = y
      x += (next.x - pos.x) * 0.42
      y += (next.y - pos.y) * 0.35
    }
  }

  /** block 模式：用多条描边线段绘制拖尾 */
  function drawLines() {
    context.beginPath()
    context.lineJoin = 'round'
    context.strokeStyle = particlesColor
    const lineWidth = Math.min(sizeX, sizeY)
    context.lineWidth = lineWidth
    if (useShadow) {
      context.shadowColor = shadowColor
      context.shadowBlur = shadowBlur
    }
    const ymut = (sizeY - lineWidth) / 3
    for (let yoffset = 0; yoffset <= 3; yoffset++) {
      const offset = yoffset * ymut
      for (let i = 0; i < particles.length; i++) {
        const pos = particles[i].position
        if (i === 0) {
          context.moveTo(pos.x, pos.y + offset + lineWidth / 2)
        }
        else {
          context.lineTo(pos.x, pos.y + offset + lineWidth / 2)
        }
      }
    }
    context.stroke()
  }

  /** line 模式：用填充路径绘制拖尾 */
  function drawPath() {
    context.beginPath()
    context.fillStyle = particlesColor
    if (useShadow) {
      context.shadowColor = shadowColor
      context.shadowBlur = shadowBlur
    }
    for (let i = 0; i < totalParticles; i++) {
      const pos = particles[i].position
      if (i === 0)
        context.moveTo(pos.x, pos.y)
      else context.lineTo(pos.x, pos.y)
    }
    for (let i = totalParticles - 1; i >= 0; i--) {
      const pos = particles[i].position
      context.lineTo(pos.x, pos.y + sizeY)
    }
    context.closePath()
    context.fill()

    context.beginPath()
    context.lineJoin = 'round'
    context.strokeStyle = particlesColor
    context.lineWidth = Math.min(sizeX, sizeY)
    const offset = -sizeX / 2 + sizeY / 2
    for (let i = 0; i < particles.length; i++) {
      const pos = particles[i].position
      if (i === 0)
        context.moveTo(pos.x, pos.y + offset)
      else context.lineTo(pos.x, pos.y + offset)
    }
    context.stroke()
  }

  function updateParticles() {
    if (!cursorsInitted)
      return
    context.clearRect(0, 0, width, height)
    calculatePosition()
    if (style === 'line')
      drawPath()
    else drawLines()
  }

  function updateCursorSize(newW: number, newH: number) {
    sizeX = newW
    sizeY = newH
  }

  return { updateParticles, move, updateSize, updateCursorSize }
}

// ─── createCursorHandler：光标 DOM 追踪模块 ───────────────────────────────────

interface CursorHandlerFunctions {
  cursorUpdatePollingRate?: number
  onStarted?: (editor: Element) => void
  onReady?: () => void
  onCursorPositionUpdated?: (x: number, y: number) => void
  onEditorSizeUpdated?: (w: number, h: number) => void
  onCursorSizeUpdated?: (w: number, h: number) => void
  onCursorVisibilityChanged?: (visibility: string) => void
  onLoop?: () => void
}

async function createCursorHandler(fns: CursorHandlerFunctions): Promise<void> {
  // 轮询等待编辑器 DOM 节点挂载完成
  let editor: Element | null = null
  while (!editor) {
    await new Promise<void>(r => setTimeout(r, 100))
    editor = document.querySelector('.part.editor')
  }
  fns.onStarted?.(editor)

  const updateHandlers: Array<(ex: number, ey: number) => void> = []
  let cursorId = 0
  const lastObjects: Record<number, Element> = {}
  let lastCursor = 0

  function createCursorUpdateHandler(
    target: HTMLElement,
    id: number,
    cursorHolder: Element,
    minimap: Element | null,
  ) {
    let lastX: number | undefined
    let lastY: number | undefined

    const update = (editorX: number, editorY: number) => {
      if (!lastObjects[id]) {
        updateHandlers.splice(updateHandlers.indexOf(update), 1)
        return
      }
      const { left: newX, top: newY } = target.getBoundingClientRect()
      const revX = newX - editorX
      const revY = newY - editorY
      if (revX === lastX && revY === lastY && lastCursor === id)
        return
      lastX = revX
      lastY = revY
      if (revX <= 0 || revY <= 0)
        return
      if (target.style.visibility === 'hidden')
        return
      if (
        minimap
        && (minimap as HTMLElement).offsetWidth !== 0
        && minimap.getBoundingClientRect().left <= newX
      ) {
        return
      }
      if (cursorHolder.getBoundingClientRect().left > newX)
        return
      lastCursor = id
      fns.onCursorPositionUpdated?.(revX, revY)
      fns.onCursorSizeUpdated?.(target.clientWidth, target.clientHeight)
    }
    updateHandlers.push(update)
  }

  let lastVisibility = 'hidden'
  setInterval(() => {
    const now: number[] = []
    let count = 0
    for (const target of Array.from(editor!.getElementsByClassName('cursor')) as HTMLElement[]) {
      if (target.style.visibility !== 'hidden')
        count++
      if (target.hasAttribute('cursorId')) {
        now.push(Number(target.getAttribute('cursorId')))
        continue
      }
      const thisId = cursorId++
      now.push(thisId)
      lastObjects[thisId] = target
      target.setAttribute('cursorId', String(thisId))
      const cursorHolder = target.parentElement!.parentElement!.parentElement!
      const minimap = cursorHolder.parentElement?.querySelector('.minimap') ?? null
      createCursorUpdateHandler(target, thisId, cursorHolder, minimap)
    }

    const visibility = count <= 1 ? 'visible' : 'hidden'
    if (visibility !== lastVisibility) {
      fns.onCursorVisibilityChanged?.(visibility)
      lastVisibility = visibility
    }

    for (const idStr of Object.keys(lastObjects)) {
      if (!now.includes(Number(idStr))) {
        delete lastObjects[Number(idStr)]
      }
    }
  }, fns.cursorUpdatePollingRate ?? 500)

  function updateLoop() {
    const { left: ex, top: ey } = editor!.getBoundingClientRect()
    for (const handler of updateHandlers) handler(ex, ey)
    fns.onLoop?.()
    requestAnimationFrame(updateLoop)
  }

  function updateEditorSize() {
    fns.onEditorSizeUpdated?.(
      (editor as HTMLElement).clientWidth,
      (editor as HTMLElement).clientHeight,
    )
  }
  new ResizeObserver(updateEditorSize).observe(editor)
  updateEditorSize()

  updateLoop()
  fns.onReady?.()
}

// ─── 启动入口（在 workbench 渲染进程中执行）──────────────────────────────────

let cursorCanvas: HTMLCanvasElement
let trailHandle: TrailHandle

createCursorHandler({
  cursorUpdatePollingRate: CURSOR_UPDATE_POLLING_RATE,

  onStarted(editor) {
    cursorCanvas = document.createElement('canvas')
    cursorCanvas.style.pointerEvents = 'none'
    cursorCanvas.style.position = 'absolute'
    cursorCanvas.style.top = '0px'
    cursorCanvas.style.left = '0px'
    cursorCanvas.style.zIndex = '1000'
    editor.appendChild(cursorCanvas)

    let color = TRAIL_COLOR
    if (color === 'default') {
      const body = document.querySelector('body>.monaco-workbench')
      if (body) {
        color = getComputedStyle(body)
          .getPropertyValue('--vscode-editorCursor-background')
          .trim()
      }
    }

    trailHandle = createTrail({
      length: TRAIL_LENGTH,
      color,
      size: 7,
      style: CURSOR_STYLE,
      canvas: cursorCanvas,
      useShadow: USE_SHADOW,
      shadowColor: SHADOW_COLOR,
      shadowBlur: SHADOW_BLUR,
    })
  },

  onReady() { },

  onCursorPositionUpdated(x, y) {
    trailHandle.move(x, y)
  },

  onEditorSizeUpdated(w, h) {
    trailHandle.updateSize(w, h)
  },

  onCursorSizeUpdated(w, h) {
    trailHandle.updateCursorSize(w, h)
  },

  onCursorVisibilityChanged(visibility) {
    cursorCanvas.style.visibility = visibility
  },

  onLoop() {
    trailHandle.updateParticles()
  },
})
