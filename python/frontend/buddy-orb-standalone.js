/**
 * Hey buddy Standalone Orb Animation Module
 * 
 * DESCRIPTION:
 * This is a self-contained WebGL renderer that creates a living, swirling 3D orb.
 * It is designed to be used as a background or centerpiece for AI assistants.
 * 
 * HOW TO USE IN 3 STEPS:
 * 1. Include this script in your HTML: <script src="buddy-orb-standalone.js"></script>
 * 2. Create a container in your HTML: <div id="orb-container"></div>
 * 3. Initialize it: const myOrb = new OrbComponent('orb-container');
 * 
 * TO MAKE IT "SPEAK":
 * myOrb.setActive(true);  // Starts the energetic "speaking" animation
 * myOrb.setActive(false); // Returns to calm "idle" animation
 */

class OrbComponent {
    /**
     * @param {string} containerId - The ID of the HTML element to put the orb in.
     * @param {Object} options - Customization (optional)
     */
    constructor(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`OrbComponent: Container #${containerId} not found.`);
            return;
        }

        // 1. Setup Container Styles automatically
        this._applyStyles(container);

        // 2. Initialize the WebGL Renderer
        this.renderer = new _OrbRendererInternal(container, {
            hue: options.hue || 0,
            hoverIntensity: options.hoverIntensity || 0.3,
            backgroundColor: options.backgroundColor || [0.02, 0.02, 0.06] // Dark Navy
        });
    }

    /**
     * Toggles the "Speaking" state of the orb.
     * @param {boolean} isActive - True to animate, False to idle.
     */
    setActive(isActive) {
        if (this.renderer) {
            this.renderer.setActive(isActive);
        }
    }

    /**
     * Automatically follow an <audio> element.
     * When the audio plays, the orb animates. When it pauses/ends, it idles.
     * @param {HTMLAudioElement} audioElement 
     */
    syncWithAudio(audioElement) {
        audioElement.addEventListener('play', () => this.setActive(true));
        audioElement.addEventListener('pause', () => this.setActive(false));
        audioElement.addEventListener('ended', () => this.setActive(false));
    }

    _applyStyles(el) {
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '0';
        el.style.width = '100vw';
        el.style.height = '100vh';
        el.style.zIndex = '-1'; // Put it in the background
        el.style.pointerEvents = 'none'; // Don't block clicks
        el.style.overflow = 'hidden';
    }
}

/** 
 * INTERNAL WEBGL RENDERER 
 * (The math-heavy engine that draws the orb)
 */
class _OrbRendererInternal {
    constructor(container, opts = {}) {
        this.container = container;
        this.hue = opts.hue;
        this.hoverIntensity = opts.hoverIntensity;
        this.bgColor = opts.backgroundColor;

        this.targetHover = 0;
        this.currentHover = 0;
        this.currentRot = 0;
        this.lastTs = 0;

        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.container.appendChild(this.canvas);

        this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
        if (!this.gl) return;

        this._init();
        this._resize();
        window.addEventListener('resize', () => this._resize());
        this._loop();
    }

    static VERT = `
        precision highp float;
        attribute vec2 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=vec4(position,0.0,1.0); }
    `;

    static FRAG = `
        precision highp float;
        uniform float iTime;
        uniform vec3 iResolution;
        uniform float hue;
        uniform float hover;
        uniform float rot;
        uniform float hoverIntensity;
        uniform vec3 backgroundColor;
        varying vec2 vUv;

        vec3 rgb2yiq(vec3 c){float y=dot(c,vec3(.299,.587,.114));float i=dot(c,vec3(.596,-.274,-.322));float q=dot(c,vec3(.211,-.523,.312));return vec3(y,i,q);}
        vec3 yiq2rgb(vec3 c){return vec3(c.x+.956*c.y+.621*c.z,c.x-.272*c.y-.647*c.z,c.x-1.106*c.y+1.703*c.z);}
        vec3 adjustHue(vec3 color,float hueDeg){float h=hueDeg*3.14159265/180.0;vec3 yiq=rgb2yiq(color);float cosA=cos(h);float sinA=sin(h);float i2=yiq.y*cosA-yiq.z*sinA;float q2=yiq.y*sinA+yiq.z*cosA;yiq.y=i2;yiq.z=q2;return yiq2rgb(yiq);}
        vec3 hash33(vec3 p3){p3=fract(p3*vec3(.1031,.11369,.13787));p3+=dot(p3,p3.yxz+19.19);return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx);}
        float snoise3(vec3 p){const float K1=.333333333;const float K2=.166666667;vec3 i=floor(p+(p.x+p.y+p.z)*K1);vec3 d0=p-(i-(i.x+i.y+i.z)*K2);vec3 e=step(vec3(0.0),d0-d0.yzx);vec3 i1=e*(1.0-e.zxy);vec3 i2=1.0-e.zxy*(1.0-e);vec3 d1=d0-(i1-K2);vec3 d2=d0-(i2-K1);vec3 d3=d0-0.5;vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));return dot(vec4(31.316),n);}
        vec4 extractAlpha(vec3 c){float a=max(max(c.r,c.g),c.b);return vec4(c/(a+1e-5),a);}

        const vec3 c1=vec3(.61,.26,.99), c2=vec3(.29,.76,.91), c3=vec3(.06,.07,.6);

        vec4 draw(vec2 uv){
            vec3 h1=adjustHue(c1,hue), h2=adjustHue(c2,hue), h3=adjustHue(c3,hue);
            float ang=atan(uv.y,uv.x), len=length(uv);
            float n0=snoise3(vec3(uv*0.65,iTime*0.5))*0.5+0.5;
            float r0=mix(0.64,0.76,n0);
            float d0=distance(uv,(r0/(len+1e-5))*uv);
            float v0=1.0/(1.0+d0*10.0);
            v0*=smoothstep(r0*1.05,r0,len);
            float cl=cos(ang+iTime*2.0)*0.5+0.5;
            vec2 pos=vec2(cos(iTime*-1.0),sin(iTime*-1.0))*r0;
            float v1=(1.5/(1.0+pow(distance(uv,pos),2.0)*5.0))*(1.0/(1.0+d0*50.0));
            float v2=smoothstep(1.0,mix(0.6,1.0,n0*0.5),len);
            float v3=smoothstep(0.6,0.8,len);
            vec3 fc=mix(h3,mix(h1,h2,cl),v0);
            fc=(fc+v1)*v2*v3;
            return extractAlpha(clamp(fc,0.0,1.0));
        }

        void main(){
            vec2 center=iResolution.xy*0.5;
            vec2 uv=(vUv*iResolution.xy-center)/min(iResolution.x,iResolution.y)*2.0;
            float s=sin(rot), c=cos(rot); uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);
            uv.x+=hover*hoverIntensity*0.1*sin(uv.y*10.0+iTime);
            uv.y+=hover*hoverIntensity*0.1*sin(uv.x*10.0+iTime);
            vec4 col=draw(uv);
            gl_FragColor=vec4(col.rgb*col.a,col.a);
        }
    `;

    _init() {
        const gl = this.gl;
        const vs = this._compile(gl.VERTEX_SHADER, _OrbRendererInternal.VERT);
        const fs = this._compile(gl.FRAGMENT_SHADER, _OrbRendererInternal.FRAG);
        this.pgm = gl.createProgram();
        gl.attachShader(this.pgm, vs); gl.attachShader(this.pgm, fs);
        gl.linkProgram(this.pgm); gl.useProgram(this.pgm);

        const posLoc = gl.getAttribLocation(this.pgm, 'position');
        const uvLoc = gl.getAttribLocation(this.pgm, 'uv');

        const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

        this.u = {};
        ['iTime', 'iResolution', 'hue', 'hover', 'rot', 'hoverIntensity', 'backgroundColor'].forEach(n => {
            this.u[n] = gl.getUniformLocation(this.pgm, n);
        });
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    _compile(type, src) {
        const s = this.gl.createShader(type);
        this.gl.shaderSource(s, src); this.gl.compileShader(s);
        return s;
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.container.clientWidth * dpr;
        this.canvas.height = this.container.clientHeight * dpr;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setActive(active) { this.targetHover = active ? 1.0 : 0.0; }

    _loop(ts = 0) {
        requestAnimationFrame((t) => this._loop(t));
        const gl = this.gl; const t = ts * 0.001; const dt = t - this.lastTs; this.lastTs = t;
        this.currentHover += (this.targetHover - this.currentHover) * Math.min(dt * 4, 1);
        if (this.currentHover > 0.5) this.currentRot += dt * 0.3;

        gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.pgm);
        gl.uniform1f(this.u.iTime, t);
        gl.uniform3f(this.u.iResolution, this.canvas.width, this.canvas.height, this.canvas.width / this.canvas.height);
        gl.uniform1f(this.u.hue, this.hue);
        gl.uniform1f(this.u.hover, this.currentHover);
        gl.uniform1f(this.u.rot, this.currentRot);
        gl.uniform1f(this.u.hoverIntensity, this.hoverIntensity);
        gl.uniform3f(this.u.backgroundColor, this.bgColor[0], this.bgColor[1], this.bgColor[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}
