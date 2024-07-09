import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { XAxis, YAxis } from "../Axes"
import Lines, { Point, getAvailablePoints } from "./Lines"
import IntervalButtons, { Interval } from "../IntervalButtons"

interface LinePctChangeChartProps {
    data: Point[],
    intervals: Interval[],
    onIntervalBtnClicked: (timeFrame: string) => void,
}

const LinePctChangeChart: React.FC<LinePctChangeChartProps> = ({ data, intervals, onIntervalBtnClicked }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const intervalBtnContainerRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)

    const [dimensions, setDimensions] = useState({ width: 300, height: 300 })
    const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity)
    const dataOnRight = useRef<boolean>(false)
    const dataOnLeft = useRef<boolean>(false)

    const currIntervalIndexRef = useRef<number>(intervals.findIndex((interval) => interval.isDefault)!)
    const availablePointsRef = useRef<Point[]>([])
    const xScaleRef = useRef<d3.ScaleBand<Date>>(d3.scaleBand<Date>())
    const yScaleRef = useRef<d3.ScaleLinear<number, number, never>>(d3.scaleLinear())

    const [isDragging, setIsDragging] = useState(false)
    const [dragMousePos, setDragMousePos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })

    const [tooltipPoint, setTooltipPoint] = useState<Point | null>(null)
    const [tooltipPrevPoint, setTooltipPrevPoint] = useState<Point | null>(null)
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

    const oldTouchDistanceRef = useRef<number>(0)

    const updateDimensions = () => {
        if (containerRef.current) {
            const { clientWidth: clientWidth, clientHeight: clientHeight } = containerRef.current
            if (intervalBtnContainerRef.current) {
                const { clientHeight: intervalsClientHeight } = intervalBtnContainerRef.current
                setDimensions({ width: clientWidth, height: clientHeight - intervalsClientHeight })
            }
            else {
                setDimensions({ width: clientWidth, height: clientHeight })
            }
        }
    }

    useEffect(() => {
        updateDimensions()
    }, [data])

    useEffect(() => {
        updateDimensions()
        window.addEventListener("resize", updateDimensions)
        return () => window.removeEventListener("resize", updateDimensions)
    }, [])

    if (data.length === 0) return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

    const { width, height } = dimensions
    const margin = { top: 15, right: 10, bottom: 40, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xMin = 0
    const xMax = innerWidth

    let baseVal = data[0].value

    let xScale = d3.scaleBand<Date>()
        .domain(data.map((point) => point.date))
        .range([0, innerWidth])
        .paddingOuter(-0.5)
        .align(-0.5)

    let yScale = d3.scaleLinear()
        .domain([d3.min(data, (point) => point.value / baseVal * 0.9999) as number, d3.max(data, (point) => point.value / baseVal * 1.0001) as number])
        .range([innerHeight, 0])
        .nice()

    const availablePoints = getAvailablePoints(data, xScale, zoomTransform)
    if (availablePoints) {
        dataOnRight.current = availablePoints.dataOnRight
        dataOnLeft.current = availablePoints.dataOnLeft

        baseVal = availablePoints.filteredData[0].value

        xScale = xScale.domain(availablePoints.filteredData.map((point: Point) => point.date))

        yScale = yScale.domain([
            d3.min(availablePoints.filteredData, (point: Point) => point.value / baseVal * 0.9999) as number,
            d3.max(availablePoints.filteredData, (point: Point) => point.value / baseVal * 1.0001) as number
        ])
            .nice()

        const filteredData = availablePoints.filteredData.map((point => {
            return { ...point, value: point.value / baseVal }
        }))
        availablePointsRef.current = filteredData
    }
    xScaleRef.current = xScale
    yScaleRef.current = yScale

    const zoom = (scaleFactor: number, pivotX: number) => {
        const newZoomLevel = zoomTransform.k * scaleFactor

        const offsetX = (pivotX - zoomTransform.x) / zoomTransform.k
        let newX = pivotX - offsetX * newZoomLevel

        const tooFewBars = availablePointsRef.current.length < 12
        const isZoomingIn = newZoomLevel > zoomTransform.k
        const isZoomingOut = newZoomLevel < zoomTransform.k
        if (!dataOnLeft.current && !dataOnRight.current && isZoomingOut) return
        if (tooFewBars && isZoomingIn) return

        const xMinZoom = (xMin - xMax) * newZoomLevel - (xMin - xMax)
        const xMaxZoom = xMin
        const lowerFromPositionRange = newX < xMinZoom
        const upperFromPositionRange = newX > xMaxZoom
        if (!dataOnRight.current && isZoomingOut && lowerFromPositionRange) newX = xMinZoom
        if (!dataOnLeft.current && isZoomingOut && upperFromPositionRange) newX = xMaxZoom

        const newTransform = d3.zoomIdentity
            .translate(newX, 0)
            .scale(newZoomLevel)

        setZoomTransform(newTransform)
    }

    const handleMouseEnter = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        event.preventDefault()
        document.body.classList.add("h-full")
        document.body.classList.add("overflow-hidden")
    }

    const handleMouseExit = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        event.preventDefault()
        document.body.classList.remove("h-full")
        document.body.classList.remove("overflow-hidden")
        setIsDragging(false)
    }

    const handleMouseDown = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        event.preventDefault()
        setIsDragging(true)
        setDragMousePos({ x: event.clientX, y: event.clientY })
    }

    const handleMouseHover = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        event.preventDefault()
        if (isDragging) {
            const relativeOffsetX = (event.clientX - dragMousePos.x) / (zoomTransform.k)
            const newX = relativeOffsetX
            const newTransform = zoomTransform.translate(newX, 0)

            const tringToGoLeft = newTransform.x > zoomTransform.x
            const tringToGoRight = newTransform.x < zoomTransform.x

            if (!(dataOnRight.current) && tringToGoRight) return
            if (!(dataOnLeft.current) && tringToGoLeft) return

            setZoomTransform(newTransform)
            setDragMousePos({ x: event.clientX, y: event.clientY })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleMouseEnterLine = (point: Point, prevPoint: Point) => {
        setTooltipPoint(point)
        setTooltipPrevPoint(prevPoint)
    }

    const handleMouseExitLine = () => {
        setTooltipPoint(null)
        setTooltipPrevPoint(null)
    }

    const handleMouseHoverLine = (mousePosition: { x: number, y: number }) => {
        setTooltipPosition(mousePosition)
    }

    const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
        event.preventDefault()

        const scaleFactor = event.deltaY < 0 ? 1.05 : event.deltaY > 0 ? 0.95 : 1
        const pivotX = d3.pointer(event)[0]
        zoom(scaleFactor, pivotX)
    }

    const handleTouchStart = (event: React.TouchEvent<SVGSVGElement>) => {
        event.preventDefault()
        if (event.touches.length === 2) {
            const touch0 = event.touches[0]
            const touch1 = event.touches[1]

            const distance = Math.hypot(
                touch1.pageX - touch0.pageX,
                touch1.pageY - touch0.pageY
            )

            oldTouchDistanceRef.current = distance
        }
    }

    const handleTouchEnd = (event: React.TouchEvent<SVGSVGElement>) => {
        event.preventDefault()
        oldTouchDistanceRef.current = 0
    }

    const handleTouchMove = (event: React.TouchEvent<SVGSVGElement>) => {
        event.preventDefault()

        if (event.touches.length === 2) {
            const touch1 = event.touches[0]
            const touch2 = event.touches[1]

            const distance = Math.hypot(
                touch2.pageX - touch1.pageX,
                touch2.pageY - touch1.pageY
            )

            const scaleFactor = distance > oldTouchDistanceRef.current ? 1.05 : 0.95
            const pivotX = d3.pointer(touch1)[0]
            zoom(scaleFactor, pivotX)

            oldTouchDistanceRef.current = distance
        }
    }

    const yFormatRules = d3.formatLocale({
        decimal: ",",
        thousands: " ",
        grouping: [3],
        currency: ["$", ""],
        numerals: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        percent: "%",
        minus: "",
        nan: "NaN"
    })
    const yAxisFormat = (value: number) => value === 1 ? "0%" : yFormatRules.format(".2%")(value - 1)

    return (
        <div ref={containerRef} className="w-full h-full flex flex-col rounded-sm justify-center items-center">
            <IntervalButtons
                ref={intervalBtnContainerRef}
                intervals={intervals}
                pickedAt={currIntervalIndexRef.current}
                onIntervalClick={(timeFrame) => {
                    availablePointsRef.current = []
                    dataOnRight.current = false
                    dataOnLeft.current = false

                    xScaleRef.current = xScale.domain([])
                    yScaleRef.current = yScale.domain([0, 0])

                    currIntervalIndexRef.current = intervals.findIndex(interval => interval.timeFrame === timeFrame)!
                    setZoomTransform(d3.zoomIdentity)

                    onIntervalBtnClicked(timeFrame)
                }}
            />
            <div className="w-full h-full bg-transparent flex justify-center items-center text-center border-2 sm:hidden landscape:hidden">
                <p>Turn your screen to see the chart</p>
            </div>
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="bg-transparent hidden touch-none sm:flex landscape:flex"
                onMouseEnter={handleMouseEnter}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseHover}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseExit}
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <XAxis
                        scale={xScaleRef.current}
                        intervalTimeOffset={intervals[currIntervalIndexRef.current].timeOffset}
                        title="Date"
                        innerHeight={innerHeight}
                    />

                    <YAxis
                        scale={yScaleRef.current}
                        title="Dollars"
                        innerWidth={innerWidth}
                        tickFormat={yAxisFormat}
                        tickClassName={(value: number) => (value - 1 < 0 ? "fill-destructive" : value - 1 > 0 ? "fill-[--success]" : "fill-foreground")}
                    />

                    <Lines
                        data={availablePointsRef.current}
                        xScale={xScaleRef.current}
                        yScale={yScaleRef.current}
                        onWheel={handleWheel}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseEnterLine={handleMouseEnterLine}
                        onMouseExitLine={handleMouseExitLine}
                        onMouseHoverLine={handleMouseHoverLine}
                    />
                </g>
            </svg>
            {
                (() => {
                    if (!tooltipPoint || !tooltipPrevPoint) return
                    const textColor = tooltipPoint.value > 0 ? "text-[--success]" : tooltipPoint.value < 0 ? "text-destructive" : "text-foreground"

                    return <div style={{ top: tooltipPosition.y, left: tooltipPosition.x }}
                        className="absolute bg-background border border-foreground p-2 m-5 shadow-xl"
                    >
                        <div>
                            <span className="text-muted-foreground font-mono">Date   : </span>
                            <span className="text-foreground">{d3.utcFormat("%a %d %b %Y %H:%M")(tooltipPoint.date)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground font-mono">All Change : </span>
                            <span className={textColor}>{yAxisFormat(tooltipPoint.value)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground font-mono">Line Change : </span>
                            <span className={textColor}>{yAxisFormat(tooltipPoint.value / tooltipPrevPoint.value)}</span>
                        </div>
                    </div>
                })()
            }
        </div>
    )
}

export default LinePctChangeChart