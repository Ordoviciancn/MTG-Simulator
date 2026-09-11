import {useEffect,useRef} from 'react';
import type {ArenaEvent} from '../shared/arenaProtocol';

// The renderer consumes confirmed events; it never sends a game command.
export function SemanticCanvas({events,ownPlayerId}:{events:ArenaEvent[];ownPlayerId:string}){
  const canvas=useRef<HTMLCanvasElement>(null),queue=useRef<{event:ArenaEvent;start:number}[]>([]),seen=useRef(0);
  useEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){queue.current=[];return;}
    for(const event of events)if(event.sequence>seen.current){seen.current=event.sequence;if(['life','cast','tap','resolve'].includes(event.kind))queue.current.push({event,start:performance.now()});}
    queue.current=queue.current.slice(-24);
  },[events]);
  useEffect(()=>{
    const node=canvas.current,gl=node?.getContext('webgl',{alpha:true,premultipliedAlpha:false});if(!node||!gl)return;
    const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);return shader;};
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 pos; uniform float size; void main(){gl_Position=vec4(pos,0.,1.);gl_PointSize=size;}');
    const fragment=compile(gl.FRAGMENT_SHADER,'precision mediump float; uniform vec4 color; void main(){float d=length(gl_PointCoord-vec2(.5))*2.;gl_FragColor=vec4(color.rgb,color.a*pow(max(0.,1.-d),2.));}');
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);return;}
    const buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const location=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    const size=gl.getUniformLocation(program,'size'),color=gl.getUniformLocation(program,'color');let frame=0;
    const draw=(time:number)=>{
      const ratio=Math.min(devicePixelRatio,2);const w=Math.floor(node.clientWidth*ratio),h=Math.floor(node.clientHeight*ratio);
      if(node.width!==w||node.height!==h){node.width=w;node.height=h;gl.viewport(0,0,w,h);}
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);queue.current=queue.current.filter(item=>time-item.start<900);
      for(const {event,start} of queue.current){
        const t=(time-start)/900,own=event.data.playerId===ownPlayerId,y=own?-.62:.68;
        const points=[];for(let i=0;i<32;i++){const angle=i*2.39996;const radius=t*(.08+(i%5)*.025);points.push(Math.cos(angle)*radius, y+Math.sin(angle)*radius);}
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STREAM_DRAW);gl.uniform1f(size,(20+(1-t)*25)*ratio);gl.uniform4f(color,1,event.kind==='life'?.22:.72,.16,(1-t)*.8);gl.drawArrays(gl.POINTS,0,32);
      }
      frame=requestAnimationFrame(draw);
    };frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);};
  },[ownPlayerId]);
  return <canvas ref={canvas} className="forge-semantic-canvas" aria-hidden="true"/>;
}
