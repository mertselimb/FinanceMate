import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { XAxis, YAxis } from "./CandlestickAxes"
import Candlesticks, { Bar, getAvailableBars } from "./Candlesticks"
import { Button } from "@/components/ui/button"

interface Interval {
    title: string,
    timeFrame: string,
    timeOffset: number
}

interface CandlestickChartProps {
    data: Bar[],
    intervals: Interval[],
    defaultIntervalIndex: number,
    onIntervalBtnClicked: (timeFrame: string) => void,
    yAxisFormatter: (value: number | { valueOf(): number }) => string,
    tooltipDateFormatter: (date: Date) => string
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, defaultIntervalIndex, intervals, onIntervalBtnClicked, yAxisFormatter, tooltipDateFormatter }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity)
    const dataOnRight = useRef<boolean>(false)
    const dataOnLeft = useRef<boolean>(false)

    const [tooltipBar, setTooltipBar] = useState<Bar | null>(null)
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
    const [tooltipTextColor, setTooltipTextColor] = useState<string>("")

    const intervalRef = useRef<Interval>(intervals[defaultIntervalIndex])
    const availableBarsRef = useRef<Bar[]>([])
    const xScaleRef = useRef<d3.ScaleBand<Date>>(d3.scaleBand<Date>())
    const yScaleRef = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear())

    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 })

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current
                setDimensions({ width: clientWidth, height: clientHeight })
            }
        }
        updateDimensions()
        window.addEventListener("resize", updateDimensions)
        return () => window.removeEventListener("resize", updateDimensions)
    }, [])

    if (data.length === 0) return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

    const { width, height } = dimensions
    const margin = { top: 50, right: 30, bottom: 30, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    let xScale = d3.scaleBand<Date>()
        .domain(data.map((bar) => bar.date))
        .range([0, innerWidth])
        .paddingInner(0.35)

    let yScale = d3.scaleLinear()
        .domain([d3.min(data, (bar) => bar.low * 0.98)!, d3.max(data, (bar) => bar.high * 1.02)!])
        .nice()
        .range([innerHeight, 0])

    const availableBars = getAvailableBars(data, xScale, yScale, zoomTransform)
    if (availableBars) {
        const filteredData = availableBars.filteredData
        availableBarsRef.current = availableBars.filteredData
        dataOnRight.current = availableBars.dataOnRight
        dataOnLeft.current = availableBars.dataOnLeft

        xScale = xScale.domain([
            new Date(filteredData[0].date.getTime() - intervalRef.current.timeOffset),
            ...filteredData.map((bar: Bar) => bar.date),
            new Date(filteredData[filteredData.length - 1].date.getTime() + intervalRef.current.timeOffset)
        ])

        yScale = yScale.domain([
            d3.min(filteredData, (bar: Bar) => bar.low * 0.98) as number,
            d3.max(filteredData, (bar: Bar) => bar.high * 1.02) as number
        ])
            .nice()
    }

    xScaleRef.current = xScale
    yScaleRef.current = yScale

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
        setDragStart({ x: event.clientX, y: event.clientY })
    }

    const handleMouseHover = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        event.preventDefault()
        if (isDragging) {
            const offsetX = (event.clientX - dragStart.x) / zoomTransform.k
            const offsetY = (event.clientY - dragStart.y) / zoomTransform.k

            const newTransform = zoomTransform.translate(offsetX, offsetY)

            if (!(dataOnLeft.current) && newTransform.x < zoomTransform.x)
                return
            if (!(dataOnRight.current) && newTransform.x > zoomTransform.x)
                return

            setZoomTransform(newTransform)
        }
        setDragStart({ x: event.clientX, y: event.clientY })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleMouseEnterCandle = (bar: Bar) => {
        setTooltipBar(bar)
        const diff = bar.close - bar.open
        setTooltipTextColor(diff > 0 ? "text-[--success]" : diff < 0 ? "text-destructive" : "text-foreground")
    }

    const handleMouseExitCandle = () => {
        setTooltipBar(null)
    }

    const handleMouseHoverCandle = (mousePosition: { x: number, y: number }) => {
        setTooltipPosition(mousePosition)
    }

    const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
        event.preventDefault()

        const scaleFactor = event.deltaY < 0 ? 1.1 : event.deltaY > 0 ? 0.9 : 1;
        const newZoomLevel = zoomTransform.k * scaleFactor
        const mousePosition = d3.pointer(event);

        const x = (mousePosition[0] - zoomTransform.x) / zoomTransform.k;
        const y = (mousePosition[1] - zoomTransform.y) / zoomTransform.k;

        const newTransform = d3.zoomIdentity
            .translate(mousePosition[0] - x * newZoomLevel, mousePosition[1] - y * newZoomLevel)
            .scale(newZoomLevel);

        if (!(dataOnLeft.current) && availableBarsRef.current.length < 10 && newTransform.x < zoomTransform.x)
            return
        if (!(dataOnRight.current) && availableBarsRef.current.length < 10 && newTransform.x > zoomTransform.x)
            return
        if (!(dataOnRight.current) && !(dataOnRight.current) && newTransform.k < zoomTransform.k)
            return
        if (dataOnRight.current && dataOnRight.current && availableBarsRef.current.length < 10 && newTransform.k > zoomTransform.k)
            return

        setZoomTransform(newTransform)
    }

    return (
        <div ref={containerRef} className="w-full h-full">
            <div className="border-b-2">
                {intervals.map((interval: Interval) => (
                    <Button key={interval.timeFrame} variant="ghost" className="rounded-sm"
                        onClick={() => {
                            availableBarsRef.current = []
                            dataOnRight.current = false
                            dataOnLeft.current = false

                            xScaleRef.current = xScale.domain([])
                            yScaleRef.current = yScale.domain([0, 0])

                            intervalRef.current = interval
                            setTooltipBar(null)
                            setZoomTransform(d3.zoomIdentity)
                            onIntervalBtnClicked(interval.timeFrame)
                        }}>{interval.title}</Button>
                ))}
            </div>
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="bg-transparent"
                onWheel={handleWheel}
                onMouseEnter={handleMouseEnter}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseHover}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseExit}
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <XAxis scale={xScaleRef.current} title="Date" innerHeight={innerHeight} />
                    <YAxis scale={yScaleRef.current} title="Dollars" innerWidth={innerWidth}
                        innerHeight={innerHeight} formatter={yAxisFormatter} />
                    <Candlesticks data={availableBarsRef.current} xScale={xScaleRef.current}
                        yScale={yScaleRef.current}
                        onMouseEnterCandle={handleMouseEnterCandle}
                        onMouseExitCandle={handleMouseExitCandle}
                        onMouseHoverCandle={handleMouseHoverCandle}
                    />
                </g>
            </svg>
            {tooltipBar && !isDragging && (
                <div ref={tooltipRef} style={{ top: tooltipPosition.y, left: tooltipPosition.x }} className="absolute bg-background border border-foreground p-2 m-5">
                    <div><span className="text-muted-foreground">Date: </span><span>{tooltipDateFormatter(tooltipBar.date)}</span></div>
                    <div><span className="text-muted-foreground">Open: </span><span className={tooltipTextColor}>{d3.format("$~f")(tooltipBar.open)}</span></div>
                    <div><span className="text-muted-foreground">High: </span><span className={tooltipTextColor}>{d3.format("$~f")(tooltipBar.high)}</span></div>
                    <div><span className="text-muted-foreground">Low: </span><span className={tooltipTextColor}>{d3.format("$~f")(tooltipBar.low)}</span></div>
                    <div><span className="text-muted-foreground">Close: </span><span className={tooltipTextColor}>{d3.format("$~f")(tooltipBar.close)}</span></div>
                </div>
            )}
        </div>
    )
}

export default CandlestickChart
