import { CollaborationService } from './collaboration'

interface Annotation {
  id: string
  type: 'draw' | 'text' | 'pointer' | 'highlight'
  color: string
  points?: { x: number; y: number }[]
  text?: string
  position?: { x: number; y: number }
  userId: string
  timestamp: number
}

interface AnnotationState {
  annotations: Map<string, Annotation>
  isDrawing: boolean
  currentTool: Annotation['type']
  currentColor: string
}

export class ScreenAnnotationService {
  private static instance: ScreenAnnotationService
  private collaboration: CollaborationService
  private state: AnnotationState = {
    annotations: new Map(),
    isDrawing: false,
    currentTool: 'pointer',
    currentColor: '#FF0000'
  }
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  private constructor() {
    this.collaboration = CollaborationService.getInstance()
    this.setupSocketHandlers()
  }

  static getInstance(): ScreenAnnotationService {
    if (!ScreenAnnotationService.instance) {
      ScreenAnnotationService.instance = new ScreenAnnotationService()
    }
    return ScreenAnnotationService.instance
  }

  initialize(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.setupEventListeners()
  }

  private setupSocketHandlers() {
    this.collaboration.socket?.on('annotation_added', (annotation: Annotation) => {
      this.state.annotations.set(annotation.id, annotation)
      this.redraw()
    })

    this.collaboration.socket?.on('annotation_updated', (annotation: Annotation) => {
      this.state.annotations.set(annotation.id, annotation)
      this.redraw()
    })

    this.collaboration.socket?.on('annotation_deleted', (id: string) => {
      this.state.annotations.delete(id)
      this.redraw()
    })

    this.collaboration.socket?.on('annotations_cleared', () => {
      this.state.annotations.clear()
      this.redraw()
    })
  }

  private setupEventListeners() {
    if (!this.canvas) return

    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.canvas) return

    this.state.isDrawing = true
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      type: this.state.currentTool,
      color: this.state.currentColor,
      points: [{ x, y }],
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    }

    this.state.annotations.set(annotation.id, annotation)
    this.collaboration.socket?.emit('annotation_added', annotation)
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.canvas || !this.state.isDrawing) return

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const currentAnnotation = Array.from(this.state.annotations.values())
      .find(a => a.userId === this.collaboration.userId && a.timestamp === Date.now())

    if (currentAnnotation && currentAnnotation.points) {
      currentAnnotation.points.push({ x, y })
      this.state.annotations.set(currentAnnotation.id, currentAnnotation)
      this.collaboration.socket?.emit('annotation_updated', currentAnnotation)
      this.redraw()
    }
  }

  private handleMouseUp() {
    this.state.isDrawing = false
  }

  setTool(tool: Annotation['type']) {
    this.state.currentTool = tool
  }

  setColor(color: string) {
    this.state.currentColor = color
  }

  addTextAnnotation(text: string, position: { x: number; y: number }) {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      type: 'text',
      color: this.state.currentColor,
      text,
      position,
      userId: this.collaboration.userId || '',
      timestamp: Date.now()
    }

    this.state.annotations.set(annotation.id, annotation)
    this.collaboration.socket?.emit('annotation_added', annotation)
    this.redraw()
  }

  clearAnnotations() {
    this.state.annotations.clear()
    this.collaboration.socket?.emit('annotations_cleared')
    this.redraw()
  }

  private redraw() {
    if (!this.ctx || !this.canvas) return

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (const annotation of this.state.annotations.values()) {
      this.ctx.strokeStyle = annotation.color
      this.ctx.fillStyle = annotation.color
      this.ctx.lineWidth = 2

      switch (annotation.type) {
        case 'draw':
          if (annotation.points && annotation.points.length > 1) {
            this.ctx.beginPath()
            this.ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
            for (let i = 1; i < annotation.points.length; i++) {
              this.ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
            }
            this.ctx.stroke()
          }
          break

        case 'text':
          if (annotation.text && annotation.position) {
            this.ctx.font = '16px sans-serif'
            this.ctx.fillText(annotation.text, annotation.position.x, annotation.position.y)
          }
          break

        case 'pointer':
          if (annotation.points && annotation.points.length > 0) {
            const point = annotation.points[0]
            this.ctx.beginPath()
            this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
            this.ctx.fill()
          }
          break

        case 'highlight':
          if (annotation.points && annotation.points.length > 1) {
            this.ctx.globalAlpha = 0.3
            this.ctx.beginPath()
            this.ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
            for (let i = 1; i < annotation.points.length; i++) {
              this.ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
            }
            this.ctx.stroke()
            this.ctx.globalAlpha = 1
          }
          break
      }
    }
  }
} 