
import { select } from 'd3-selection';
import { line, area, curveCatmullRom } from 'd3-shape';
import { max, min } from 'd3-array';
import { scaleLinear, scaleLog, scaleTime } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { timeFormat, timeFormatDefaultLocale } from 'd3-time-format';
import { format, formatDefaultLocale } from 'd3-format';
import * as times from 'd3-time';

import { html as svg } from '@redsift/d3-rs-svg';
import { units, time } from "@redsift/d3-rs-intl";
import { tip } from "@redsift/d3-rs-tip";
import { 
  random as random, 
  presentation10 as presentation10,
  display as display
} from '@redsift/d3-rs-theme';

const DEFAULT_SIZE = 420;
const DEFAULT_ASPECT = 160 / 420;
const DEFAULT_MARGIN = 40;  // white space
const DEFAULT_INSET = 24;   // scale space
const DEFAULT_TICK_FORMAT_VALUE = ',.0f';
const DEFAULT_TICK_FORMAT_VALUE_SI = '.2s';
const DEFAULT_TICK_FORMAT_VALUE_SMALL = '.3f';
const DEFAULT_TICK_COUNT = 4;
const DEFAULT_SCALE = 42; // why not
const DEFAULT_LEGEND_SIZE = 10;
const DEFAULT_LEGEND_PADDING_X = 8;
const DEFAULT_LEGEND_PADDING_Y = 24;
const DEFAULT_LEGEND_TEXT_SCALE = 8; // hack value to do fast estimation of length of string
const DEFAULT_HIGHLIGHT_TEXT_PADDING = 2;
// Font fallback chosen to keep presentation on places like GitHub where Content Security Policy prevents inline SRC
const DEFAULT_STYLE = "@import url(https://fonts.googleapis.com/css?family=Source+Code+Pro:300); text{ font-family: 'Source Code Pro', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-weight: 300; fill: " + display.text.black + "; } .axis path, .axis line { fill: none; stroke: " + display.lines.seperator + "; shape-rendering: crispEdges; } .lines path { fill: none } line { stroke-width: 1.5px } line.grid { stroke-width: 1.0px } .legend text { font-size: 12px } .highlight { opacity: 0.66 } .highlight text { font-size: 12px } ";

export default function lines(id) {
  let classed = 'chart-lines', 
      theme = 'light',
      background = null,
      width = DEFAULT_SIZE,
      height = null,
      margin = { top: 0, left: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, right: 0 },
      style = DEFAULT_STYLE,
      scale = 1.0,
      logValue = 0,
      minValue = null,
      maxValue = null,
      minIndex = null,
      maxIndex = null,
      inset = DEFAULT_INSET,
      tickFormatValue = null,
      tickDisplayValue = null,
      tickDisplayIndex = null,
      tickCountValue = DEFAULT_TICK_COUNT,
      tickCountIndex = null,
      niceValue = true,
      niceIndex = true,
      gridValue = true,
      gridIndex = false,
      language = null,
      legend = [ ],
      fill = null,
      labelTime = null,
      highlight = [ ],
      displayTip = -1,
      value = function (d, i) {
        if (Array.isArray(d)) {
          return d;
        }
        if (typeof d === 'object') {
          i = (d.l === undefined) ? i : d.l;
          d = d.v;
        }

        return [ i, d ];
      };

  // [ [ [i1,v1], [i1,v1] ], [ [i2,v2] ... ], ... ]
  function _flatArrays(a) {
      // TODO: Series support
      return a.map(d => [ d[0], Array.isArray(d[1]) ? d[1][0] : d[1] ])
  }
    
  function _coerceArray(d) {
    if (d == null) {
      return [];
    }
    
    if (!Array.isArray(d)) {
        return [ d ];
    }
    
    return d;
  }
  
  function _mapTickCount(t) {
    if (t == null) return null;
    // TODO: does not seem to behave
    if (typeof t === 'string') {
      return times[t];
    }
    return t;
  }
  
  function _makeFillFn() {
    let colors = () => fill;
    if (fill == null) {
      colors = () => presentation10.standard[0];
    } else if (typeof fill === 'function') {
      colors = fill;
    } else if (Array.isArray(fill)) {
      let count = -1;
      colors = () => (count++, fill[ count % fill.length ])
    }
    return colors;  
  }  
  
  function _impl(context) {
    let selection = context.selection ? context.selection() : context,
        transition = (context.selection !== undefined);
   
    formatDefaultLocale(units(language).d3);

    let defaultValueFormat = format(DEFAULT_TICK_FORMAT_VALUE);
    let defaultValueFormatSi = format(DEFAULT_TICK_FORMAT_VALUE_SI);
    let defaultValueFormatSmall = format(DEFAULT_TICK_FORMAT_VALUE_SMALL);    

    let formatTime = null;
    if (labelTime != null) {
      timeFormatDefaultLocale(time(language).d3);
      formatTime = timeFormat(labelTime);
    }
      
    let scaleFn = tickDisplayValue;
    if (scaleFn == null && logValue === 0) {
      if (tickFormatValue != null) {
        let fn = format(tickFormatValue);
        scaleFn = (i) => fn(i); 
      } else {
        scaleFn = function (i) {
          if (i === 0.0) {
            return defaultValueFormat(i);
          } else if (i > 9999 || i <= 0.001) {
            return defaultValueFormatSi(i);  
          } else if (i < 1) {
            return defaultValueFormatSmall(i);  
          } else {
            return defaultValueFormat(i);
          }
        }
      }
    }
      
    selection.each(function() {
      let node = select(this);  
      let sh = height || Math.round(width * DEFAULT_ASPECT);
      
      // SVG element
      let sid = null;
      if (id) sid = 'svg-' + id;
      let root = svg(sid).width(width).height(sh).margin(margin).scale(scale);
      let tnode = node;
      if (transition === true) {
        tnode = node.transition(context);
      }
      tnode.call(root);
      
      let elmS = node.select(root.self()).select(root.child());

      // Tip
      let tid = null;
      if (id) tid = 'tip-' + id;
      let rtip = tip(tid).html((d) => d);
      let st = style + ' ' + rtip.style();
      rtip.style(st);
      elmS.call(rtip);
    
      // Create required elements
      let g = elmS.select(_impl.self())
      if (g.empty()) {
        g = elmS.append('g').attr('class', classed).attr('id', id);
        g.append('g').attr('class', 'axis-v axis');
        g.append('g').attr('class', 'axis-i axis');
        g.append('g').attr('class', 'legend');
        g.append('g').attr('class', 'lines');
      }

      let data = g.datum() || [];
      
      let vdata = _flatArrays(data.map((d, i) => value(d, i)));
      
      console.log(vdata);
      
      g.datum(vdata); // this rebind is required even though there is a following select

      let minV = minValue;
      if (minV == null) {
        minV = min(vdata, (d) => d[1]);
        if (minV > 0) {
          minV = logValue === 0 ? 0 : 1;
        }
      }
            
      let maxV = maxValue;
      if (maxV == null) {
        maxV = max(vdata, d => d[1]);
      }
      
      let minI = minIndex;
      if (minI == null) {
        minI = min(vdata, (d) => d[0]);
      }
      
      let maxI = maxIndex;
      if (maxI == null) {
        maxI = max(vdata, (d) => d[0]);
      }
                        
      let w = root.childWidth(),
          h = root.childHeight();
      
      // Create the legend
      if (legend.length > 0) {
        h = h - (DEFAULT_LEGEND_SIZE + DEFAULT_LEGEND_PADDING_Y);
        let rg = g.select('g.legend');
        let lg = rg.attr('transform', 'translate(' + (w/2) + ',' + (h + DEFAULT_LEGEND_PADDING_Y) + ')').selectAll('g').data(legend);
        lg.exit().remove();
        let newlg = lg.enter().append('g');
        
        let colors = () => 'red';

        newlg.append('rect')
              .attr('width', DEFAULT_LEGEND_SIZE)
              .attr('height', DEFAULT_LEGEND_SIZE)
              .attr('fill', colors);

        newlg.append('text')
          .attr('dominant-baseline', 'central')
          .attr('y', DEFAULT_LEGEND_SIZE / 2)
          .attr('x', () => DEFAULT_LEGEND_SIZE + DEFAULT_LEGEND_PADDING_X);
              
        lg = newlg.merge(lg);

        lg.selectAll('text').text((d) => d);

        let lens = legend.map((s) => s.length * DEFAULT_LEGEND_TEXT_SCALE + DEFAULT_LEGEND_SIZE + 2 * DEFAULT_LEGEND_PADDING_X);
        let clens = []
        let total = lens.reduce((p, c) => (clens.push(p) , p + c), 0);
        
        let offset = -total / 2;
        rg.selectAll('g').data(clens).attr('transform', (d) => 'translate(' + (offset + d) + ',0)');
      }            
      
      let sV = scaleLinear(); 
      if (logValue > 0) sV = scaleLog().base(logValue);
      let scaleV = sV.domain([ minV, maxV ]).range([ h, inset ]);
      if (niceValue === true) {
        scaleV = scaleV.nice();
      }
            
      let sI = scaleLinear(); 
      if (labelTime != null) sI = scaleTime();
      let domainI = [ minI, maxI ];
      let scaleI = sI.domain(domainI).range([ 0, w - inset ]);
      if (niceIndex === true) {
        scaleI = scaleI.nice();
      }
            
      let aV = axisLeft(scaleV).ticks(tickCountValue, (tickFormatValue == null ? DEFAULT_TICK_FORMAT_VALUE : tickFormatValue));
      if (gridValue === true) {
        aV.tickSizeInner(inset - w);
      }
      aV.tickFormat(scaleFn);

      g.select('g.axis-v')
        .attr('transform', 'translate(0,0)')
        .call(aV)
        .selectAll('line')
          .attr('class', gridValue ? 'grid' : null);

      let aI = axisBottom(scaleI);
      if (labelTime != null) aI = aI.ticks(_mapTickCount(tickCountIndex), labelTime);
      if (gridIndex === true) {
        aI.tickSizeInner(inset - h);
      }  
      if (tickDisplayIndex != null) {
        aI.tickFormat(i => tickDisplayIndex(i));
      }   
      
      g.select('g.axis-i')
        .attr('transform', 'translate(0,' + h + ')')
        .call(aI)
        .selectAll('line')
          .attr('class', gridIndex ? 'grid' : null);  
          
      let lines = line()
        .x(d => scaleI(d[0]))
        .y(d => scaleV(d[1]))
        .curve(curveCatmullRom.alpha(0));  
      
      let colors = _makeFillFn();
      g.select('g.lines')
        .append('path')
        .attr('d', lines)
        .attr('stroke', colors);     
    });
    
  }
  
  _impl.self = function() { return 'g' + (id ?  '#' + id : '.' + classed); }

  _impl.id = function() {
    return id;
  };
    
  _impl.classed = function(value) {
    return arguments.length ? (classed = value, _impl) : classed;
  };
    
  _impl.background = function(value) {
    return arguments.length ? (background = value, _impl) : background;
  };

  _impl.theme = function(value) {
    return arguments.length ? (theme = value, _impl) : theme;
  };  

  _impl.size = function(value) {
    return arguments.length ? (width = value, height = null, _impl) : width;
  };
    
  _impl.width = function(value) {
    return arguments.length ? (width = value, _impl) : width;
  };  

  _impl.height = function(value) {
    return arguments.length ? (height = value, _impl) : height;
  }; 

  _impl.scale = function(value) {
    return arguments.length ? (scale = value, _impl) : scale;
  }; 

  _impl.margin = function(value) {
    return arguments.length ? (margin = value, _impl) : margin;
  };   

  _impl.logValue = function(value) {
    return arguments.length ? (logValue = value, _impl) : logValue;
  }; 

  _impl.minValue = function(value) {
    return arguments.length ? (minValue = value, _impl) : minValue;
  };  

  _impl.maxValue = function(value) {
    return arguments.length ? (maxValue = value, _impl) : maxValue;
  };  

  _impl.minIndex = function(value) {
    return arguments.length ? (minIndex = value, _impl) : minIndex;
  };  

  _impl.maxIndex = function(value) {
    return arguments.length ? (maxIndex = value, _impl) : maxIndex;
  };  

  _impl.inset = function(value) {
    return arguments.length ? (inset = value, _impl) : inset;
  };  

  _impl.tickFormatValue = function(value) {
    return arguments.length ? (tickFormatValue = value, _impl) : tickFormatValue;
  };  

  _impl.tickDisplayValue = function(value) {
    return arguments.length ? (tickDisplayValue = value, _impl) : tickDisplayValue;
  };    

  _impl.tickDisplayIndex = function(value) {
    return arguments.length ? (tickDisplayIndex = value, _impl) : tickDisplayIndex;
  };   

  _impl.style = function(value) {
    return arguments.length ? (style = value, _impl) : style;
  }; 
  
  _impl.value = function(valuep) {
    return arguments.length ? (value = valuep, _impl) : value;
  };
  
  _impl.language = function(value) {
    return arguments.length ? (language = value, _impl) : language;
  };   
  
  _impl.legend = function(value) {
    return arguments.length ? (legend = _coerceArray(value), _impl) : legend;
  }; 
   
  _impl.labelTime = function(value) {
    return arguments.length ? (labelTime = value, _impl) : labelTime;
  };   
  
  _impl.tickCountValue = function(value) {
    return arguments.length ? (tickCountValue = value, _impl) : tickCountValue;
  }; 
   
  _impl.tickCountIndex = function(value) {
    return arguments.length ? (tickCountIndex = value, _impl) : tickCountIndex;
  };     
  
  _impl.displayTip = function(value) {
    return arguments.length ? (displayTip = value, _impl) : displayTip;
  };   
  
  _impl.highlight = function(value) {
    return arguments.length ? (highlight = _coerceArray(value), _impl) : highlight;
  };    

  _impl.gridValue = function(value) {
    return arguments.length ? (gridValue = value, _impl) : gridValue;
  };     

  _impl.gridIndex = function(value) {
    return arguments.length ? (gridIndex = value, _impl) : gridIndex;
  };    

  _impl.niceValue = function(value) {
    return arguments.length ? (niceValue = value, _impl) : niceValue;
  };     

  _impl.niceIndex = function(value) {
    return arguments.length ? (niceIndex = value, _impl) : niceIndex;
  }; 
  
  _impl.fill = function(value) {
    return arguments.length ? (fill = value, _impl) : fill;
  };    
              
  return _impl;
}