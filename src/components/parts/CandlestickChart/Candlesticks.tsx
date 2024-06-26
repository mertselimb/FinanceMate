import * as d3 from "d3"

export interface Bar {
    date: Date
    low: number
    open: number
    close: number
    high: number
}

export const getAvailableBars = (data: Bar[],
    xScale: d3.ScaleBand<Date>,
    zoomTransform: d3.ZoomTransform) => {

    const [xMin, xMax] = xScale.range()
    let dataOnRight = true
    let dataOnLeft = true

    const filteredData = data.filter((bar: Bar, index: number) => {
        const x = zoomTransform.applyX(xScale(bar.date)!)

        if (x < xMin || x > xMax) return false

        if (index === 0)
            dataOnLeft = false
        if (index === data.length - 1)
            dataOnRight = false

        return true
    })

    if (filteredData)
        return { filteredData, dataOnRight, dataOnLeft }
    else
        return false
}

interface CandlesticksProps {
    data: Bar[],
    xScale: d3.ScaleBand<Date>,
    yScale: d3.ScaleLinear<number, number, never>,
    onWheel: (event: React.WheelEvent<SVGSVGElement>) => void,
    onMouseEnterCandle: (bar: Bar) => void
    onMouseExitCandle: () => void
    onMouseHoverCandle: (mousePosition: { x: number, y: number }) => void
}

const Candlesticks = (
    {
        data, xScale, yScale, onWheel,
        onMouseEnterCandle, onMouseExitCandle, onMouseHoverCandle
    }: CandlesticksProps) => {

    const [xMin, xMax] = xScale.range()
    const [yMax, yMin] = yScale.range()
    const width = xMax - xMin

    return (
        <g onWheel={onWheel}>
            <line x1={width / 2} x2={width / 2} y1={yMin} y2={yMax} stroke="transparent" strokeWidth={width} />

            {
                data.map((bar: Bar) => {
                    const x = xScale(bar.date)!

                    return <g key={bar.date.toString() + bar.close} transform={`translate(${x}, 0)`}
                        onMouseEnter={() => onMouseEnterCandle(bar)}
                        onMouseLeave={onMouseExitCandle}
                        onMouseMove={(e: React.MouseEvent<SVGGElement, MouseEvent>) => onMouseHoverCandle({ x: e.pageX, y: e.pageY })}
                    >
                        <line y1={yScale(bar.low)} y2={yScale(bar.high)} stroke="white" />
                        <line y1={yScale(bar.close)} y2={yScale(bar.open)} strokeWidth={xScale.bandwidth()}
                            stroke={bar.open > bar.close ? d3.schemeSet1[0]
                                : bar.close > bar.open ? d3.schemeSet1[2]
                                    : d3.schemeSet1[8]} />
                    </g>
                })
            }
        </g>
    )
}

export default Candlesticks