import*as f from'node:fs';
let I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output',D=[[0,-1],[0,1],[-1,0],[1,0]];
let P=t=>{let r=t.split('\n').filter(x=>x),h=r.length,w=Math.max(...r.map(x=>x.length)),a=new Uint8Array(w*h).fill(1),g=[],b=[],p=-1;
r.forEach((s,y)=>{for(let x=0;x<s.length;x++){let i=y*w+x,c=s[x];if(!c||c=='#')continue;a[i]=0;if('.*+'.includes(c))g.push(i);if(c=='$'||c=='*')b.push(i);if(c=='@'||c=='+')p=i}});
return{w,h,a,g,b,p}};
let L=b=>{let{w,a,g}=b,v=new Uint8Array(a.length),q=[...g];for(let x of g)v[x]=1;for(let i=0;i<q.length;i++){let x=q[i];for(let o of[-w,w,-1,1]){let y=x-o;if(!a[y]&&!a[y-o]&&!v[y]){v[y]=1;q.push(y)}}}return v};
let F=(b,o,f)=>{let{w,a}=b,p=new Int32Array(a.length).fill(-1),d=new Int8Array(a.length),q=[f],l=f;p[f]=f;
for(let i=0;i<q.length;i++){let x=q[i];if(x<l)l=x;for(let k=0;k<4;k++){let y=x+D[k][1]*w+D[k][0];if(a[y]||o[y]||p[y]!=-1)continue;p[y]=x;d[y]=k;q.push(y)}}
return[l,p,d,q]};
let S=(b,M)=>{let{w,a,g}=b,n=a.length,G=new Uint8Array(n);for(let x of g)G[x]=1;let v=L(b),o=new Uint8Array(n);
if(b.b.some(x=>!v[x]))return null;
if(b.b.every(x=>G[x]))return'';
let Q=[[b.b,b.p,'']],I=new Map();
for(let x of b.b)o[x]=1;
I.set(b.b+','+F(b,o,b.p)[0],1);
for(let x of b.b)o[x]=0;
for(let h=0;h<Q.length;h++){let[cb,pl,mv]=Q[h];
for(let x of cb)o[x]=1;
let[,pr,di]=F(b,o,pl);
for(let j=0;j<cb.length;j++){let q=cb[j];
for(let d=0;d<4;d++){let o2=[-w,w,-1,1][d],t=q+o2;
if(pr[q-o2]==-1||a[t]||o[t]||!v[t])continue;
let s='';for(let x=q-o2;x!=pl;x=pr[x])s='udlr'[di[x]]+s;
o[q]=0;o[t]=1;
let y=cb.slice();y[j]=t;y.sort((p,q)=>p-q);
let K2=y+','+F(b,o,q)[0];
o[t]=0;o[q]=1;
if(I.has(K2))continue;
if(Q.length>=M){for(let x of cb)o[x]=0;return null}
I.set(K2,1);
let nm=mv+s+'UDLR'[d];
if(y.every(x=>G[x]))return nm;
Q.push([y,q,nm])}}
for(let x of cb)o[x]=0}
return null};
let J=b=>{let{w,a,g,b:B,p}=b,v=L(b),r=Math.floor(p/w),c=new Uint8Array(a.length);
for(let i=r*w;i<(r+1)*w;i++)if(!a[i]&&!v[i])c[i]=1;
if(B.some(x=>c[x]))return null;
let t=new Int32Array(a.length).fill(-1),Y=[];
for(let s=0;s<a.length;s++){if(a[s]||c[s]||t[s]>=0)continue;for(let x of F(b,c,s)[3])t[x]=Y.length;Y.push({b:[],g:[]})}
for(let x of B)Y[t[x]].b.push(x);
for(let x of g)if(t[x]>=0)Y[t[x]].g.push(x);
if(g.some(x=>t[x]<0))return null;
if(Y.some(x=>x.b.length!=x.g.length))return null;
return Y.filter(x=>x.b.length)};
let G=t=>{let b=P(t),r=J(b);
if(!r){let s=S(b,250000);return s==null?'':s}
let p=b.p,m='';
for(let x of r){let a=b.a.slice();
for(let y of r)if(y!=x)for(let z of y.d?y.g:y.b)a[z]=1;
let s=S({...b,a,g:x.g,b:x.b,p},250000);
if(s==null){let y=S(b,250000);return y==null?'':y}
m+=s;for(let c of s.toLowerCase())p+=c=='u'?-b.w:c=='d'?b.w:c=='l'?-1:1;x.d=1}
return m};
for(let i of f.readdirSync(I)){let m='';try{m=G(f.readFileSync(I+'/'+i+'/level.txt','utf8'))}catch{m=''}f.mkdirSync(O+'/'+i,{recursive:!0});f.writeFileSync(O+'/'+i+'/solution.txt',m+'\n')}
