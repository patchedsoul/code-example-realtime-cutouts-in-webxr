
import * as THREE from          './lib/threejs/three.module.js';
import { GUI } from             './lib/dat.gui.module.js';
import { OrbitControls } from   './lib/threejs/jsm/controls/OrbitControls.js';
import { GLTFLoader } from      './lib/threejs/jsm/loaders/GLTFLoader.js';
import { FontLoader } from      './lib/threejs/jsm/loaders/FontLoader.js';
import { TextGeometry } from    './lib/threejs/jsm/geometries/TextGeometry.js';

//#########################################################################################
class Cutout{
    //-------------------------------
    constructor(){
        this.cutout;                //active cutout
        this.cutoutObject;
        this.shader;                //active shader
        this.passthroughSession;    //passthorugh XR session
        this.textureVideo;          //three video texture from video element
        this.playButton =           document.getElementById("button-playvideo");
        this.video =                document.getElementById("video");
        this.hasAudio =             true;
        this.audioEnabled =         true;
        this.isPlaying =            false;
        this.isLoading =            true;
        this.firstPlayed =          false;
        this.instancesEnabled =     false; //still a bug here
        this.guiData = {
            keyColor:               [0, 255, 0],
            similarity:             0.65,
            smoothness:             0.08
        };
        this.cutouts =               {
            "kim":    {cutout:undefined,shader:undefined,instances:undefined,instanceCount:10,instanceOffset:0.25,url:"./assets/video/kim-1920x1080.mp4",poster:"./assets/video/kim-poster.jpg",scale:0.00165,resolution:{x:1920,y:1080},ratio:1.777,audio:true,keyColor:0x00ff00,keyColorRgb:[0,255,0]},
            "dog":   {cutout:undefined,shader:undefined,instances:undefined,instanceCount:10,instanceOffset:0.25,url:"./assets/video/dog-1920x1080.mp4",poster:"./assets/video/dog-poster.jpg",scale:0.00165,resolution:{x:1920,y:1080},ratio:1.777,audio:false,keyColor:0x00ff00,keyColorRgb:[0,255,0]},
            "bean":  {cutout:undefined,shader:undefined,instances:undefined,instanceCount:10,instanceOffset:0.25,url:"./assets/video/bean-1920x1080.mp4",poster:"./assets/video/bean-poster.jpg",scale:0.00165,resolution:{x:1920,y:1080},ratio:1.777,audio:true,keyColor:0x00ff00,keyColorRgb:[0,255,0]},
        };
        this.init();
    }
    //-------------------------------
    init(){
        this.createUi();
        this.initInteractions();
        this.create(this.cutouts.bean);
        this.createBbox(this.cutouts.bean);
        this.createGui();
    }
    //-------------------------------
    createUi(){
        var container = document.getElementById('videos');
        for(var name in this.cutouts) {
            var cutout =    this.cutouts[name];
            var imgElem =   `<img class="videoSelect" id="${name}" src="${cutout.poster}">`;
            container.insertAdjacentHTML('afterbegin',imgElem);
        }
    }
    //-------------------------------
    create(_co){

        //video
        this.setVideo(_co);
       
        //shader
        if(!_co.shader)this.createShaderMaterial(_co); //create if doesn't exist
        this.shader = _co.shader;
        this.updateShaderKeyColor(_co.keyColorRgb);

        //cutout
        if(!_co.cutout)this.createCutout(_co); //create if doesn't exist
        this.cutout = _co.cutout;
        this.cutoutObject = _co;
        this.cutout.visible = true;

        //bbox
        this.updateBbox(_co);

    }
    //-------------------------------
    initInteractions(){
        this.playButton.addEventListener('click',()=>{
            this.playVideo();
            _C.XR.showEnterButton();
            this.firstPlayed = true;
        },true);
        document.getElementById('videos').addEventListener('click',(_event)=>{
            this.cutout.visible = false;
            this.playButton.style.display = 'block';
            _C.XR.hideEnterButton();
            this.create(this.cutouts[_event.target.id]);
        });
    }
    //-------------------------------
    setVideo(_settings){
        this.hasAudio = _settings.audio;
        document.getElementById('videoSrc').setAttribute('src',_settings.url);
        document.getElementById('videoFile').innerHTML = _settings.url.split("/").pop();
        this.video.load();
    }
    //-------------------------------
    playVideo(){
        this.video.play();
        this.playButton.style.display = 'none';
        this.isPlaying = true;
        for(const ui of _C.XR.ui){
            if(ui.uid.includes("playpause")){
                ui.text.mesh.visible =      this.isPlaying;
                ui.text.altmesh.visible =   !this.isPlaying;
            }
        }
    }
    //-------------------------------
    toggleAudio(_ui){
        if(!this.hasAudio)return;
        this.audioEnabled = !this.audioEnabled;
        this.video.muted = this.audioEnabled;
        _ui.text.mesh.visible =      !this.audioEnabled;
        _ui.text.altmesh.visible =   this.audioEnabled;
    }
    //-------------------------------
    togglePlayPause(_ui){
        this.isPlaying = !this.isPlaying;
        (this.isPlaying) ? this.video.play() : this.video.pause();
        _ui.text.mesh.visible =      !this.isPlaying;
        _ui.text.altmesh.visible =   this.isPlaying;
    }
    //-------------------------------
    scaleCutout(_dir){
        if(!this.cutout)return;
        if(!this.cutoutObject)return;
        this.cutoutObject.scale -= ((this.cutoutObject.scale*0.1)*_dir);
        var s = this.cutoutObject.scale;
        this.cutout.scale.set(s,s,s);
    }
    //-------------------------------
    pauseVideo(){
        this.video.pause();
    }
    //-------------------------------
    createCutout(_cutout){

        //cutout
        var py = parseInt( _cutout.resolution.y * _cutout.scale * 0.5 );
        this.position = {x:0,y:py,z:-1};
        var geo = new THREE.PlaneGeometry(_cutout.resolution.x,_cutout.resolution.y);
        _cutout.cutout = new THREE.Mesh(geo,_cutout.shader);
        _cutout.cutout.position.set(this.position.x,this.position.y,this.position.z);
        var s = _cutout.scale;
        _cutout.cutout.scale.set(s,s,s);
        _C.THREE.scene.add(_cutout.cutout);
        _cutout.cutout.name = "mesh-cutout";

        //instances
        if(!this.instancesEnabled)return;
        var geo2 = new THREE.PlaneGeometry(_cutout.resolution.x*_cutout.scale,_cutout.resolution.y*_cutout.scale);
        _cutout.instances = new THREE.InstancedMesh(geo2,_cutout.shader,_cutout.instanceCount);
        _cutout.instances.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); 
        for(var i=0;i<_cutout.instanceCount;i++){
            var x = this.position.x - ((i+1)*0.15);
            var z = this.position.z - ((i+1)*_cutout.instanceOffset);
            console.log("Z position: "+z);
            var dummy = new THREE.Object3D()
            dummy.position.set(
                x,
                this.position.y,
                z
            );
            dummy.updateMatrix();
            _cutout.instances.setMatrixAt(i,dummy.matrix);
            console.log("Matrix at instance "+i+":");console.log(dummy.matrix);
        }
        _cutout.instances.instanceMatrix.needsUpdate = true;
        _C.THREE.scene.add( _cutout.instances );

    }
    //-------------------------------
    updateBbox(_cutout){
        _C.BBOX.updateMesh(_cutout.cutout);
    }
    //-------------------------------
    createBbox(_cutout){
        _C.BBOX.create(_cutout.cutout);
        _C.XR.raycastObjects.push(_C.BBOX.box);
        _C.BBOX.box.name = "bbox-cutout"; 
        _C.THREE.scene.add(_C.BBOX.box);
        _C.THREE.scene.add(_C.BBOX.edges);
    }
    //-------------------------------
    createShaderMaterial(_cutout){
        var textureVideo =      new THREE.VideoTexture( this.video );
        var shaderMaterial =    new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                map:            { value: textureVideo },
                keyColor:       { value: [0.0, 1.0, 0.0] },
                similarity:     { value: 0.65 },
                smoothness:     { value: 0.08 },
            },
            vertexShader:       this.vertexShader(),
            fragmentShader:     this.fragmentShader(),
            side:               THREE.DoubleSide
        });
        _cutout.shader = shaderMaterial;
    }
    //-------------------------------
    update(){ //called from THREE render
        this.updateShaderMaterial();
        if(this.cutout&&_C.XR.user){
            this.cutout.lookAt(_C.XR.user.position.x,0,_C.XR.user.position.z);
        }
    }
    //-------------------------------
    updateShaderMaterial(){
        if(!this.cutout)return;
        if(this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            if(this.cutout.textureVideo) this.cutout.textureVideo.needsUpdate = true;
        }
    }
    //-------------------------------
    createGui(){
        var gui = new GUI({width:320});
        gui.addColor(this.guiData, 'keyColor').onChange(() => this.updateShaderKeyColor(this.guiData.keyColor)).listen();
        gui.add(this.guiData, 'similarity', 0.20, 0.80, 0.01).onChange(() => this.updateShaderSimilarity(this.guiData.similarity)).listen();
        gui.add(this.guiData, 'smoothness', 0.0, 0.60, 0.01).onChange(() => this.updateShaderSmoothness(this.guiData.smoothness)).listen();
    }
    //-------------------------------
    updateShaderKeyColor(v) {
        if(!this.shader)return;
        this.shader.uniforms.keyColor.value = [v[0]/255, v[1]/255, v[2]/255];
        this.guiData.keyColor = v;
    }
    //-------------------------------
    updateShaderSimilarity(v) {
        if(!this.shader)return;
        this.shader.uniforms.similarity.value = v;
    }
    //-------------------------------
    updateShaderSmoothness(v) {
        if(!this.shader)return;
        this.shader.uniforms.smoothness.value = v;
    }
    //-------------------------------
    vertexShader(){
        return `
            varying vec2 vUv;
            void main( void ) {     
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }
        `;
    }
    //-------------------------------
    fragmentShader(){
        return `
            uniform vec3 keyColor;
            uniform float similarity;
            uniform float smoothness;
            varying vec2 vUv;
            uniform sampler2D map;
            void main() {

                vec4 videoColor = texture2D(map, vUv);
        
                float Y1 = 0.299 * keyColor.r + 0.587 * keyColor.g + 0.114 * keyColor.b;
                float Cr1 = keyColor.r - Y1;
                float Cb1 = keyColor.b - Y1;
                
                float Y2 = 0.299 * videoColor.r + 0.587 * videoColor.g + 0.114 * videoColor.b;
                float Cr2 = videoColor.r - Y2; 
                float Cb2 = videoColor.b - Y2; 
                
                float blend = smoothstep(similarity, similarity + smoothness, distance(vec2(Cr2, Cb2), vec2(Cr1, Cb1)));
                gl_FragColor = vec4(videoColor.rgb, videoColor.a * blend); 
            }
        `;
    }
}

//#########################################################################################
class Three{
    //-------------------------------
    constructor(){
        this.passthroughSession; 
        this.scene; //three scene
        this.camera; //three camera
        this.renderer; //three renderer
        this.controls; //three controls
        this.grid;
        this.canvas =           document.getElementById("three");
        this.renderCounter =    0;
        this.settings =         {fov:75};
        this.init();
        this.initInteractions();
        this.start();
    }
    //-------------------------------
    init(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            this.settings.fov, 
            window.innerHeight/window.innerWidth, 
            0.1, 
            100
        );
        this.camera.position.z = 0.5;
        this.renderer = new THREE.WebGLRenderer({
            canvas:                 this.canvas,
            antialias:              true,
            alpha:                  true,
            //premultipliedAlpha:   false
        });
        //this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setClearColor( 0x000000, 0 );
        this.grid = new THREE.GridHelper(30,30);
        this.grid.position.y = -1;
        this.scene.add(this.grid);
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enabled = true;
        this.controls.target.set(0,0.1,-5);
        this.controls.update();
        const light = new THREE.AmbientLight( 0x404040 ); 
        this.scene.add( light );
        this.resize();
    }
    //-------------------------------
    initInteractions(){
        window.addEventListener('resize',()=>{
            this.resize();
        },false);
    }
    //-------------------------------
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        console.log("Resize three canvas to ["+window.innerWidth+"x"+window.innerHeight+"]");
    }
    //-------------------------------
    start(){
        this.renderer.setAnimationLoop(this.render.bind(this));
    }
    //-------------------------------
    stop(){
        this.renderer.setAnimationLoop(null);
    }
    //-------------------------------
    render(){
        this.renderer.render(this.scene,this.camera);
        this.controls.update();
        _C.CUTOUT.update();     //update cutout and keying shader
        _C.BBOX.update();       //update bbox from cutout
        _C.XR.update();         //update controller and ui
    }
}

//#########################################################################################
class XR{
    //-------------------------------
    constructor(_renderer){
        this.passthroughSession; 
        this.renderer = _renderer;
        this.controller1;
        this.controller2;
        this.raydot;
        this.enterButton =          document.getElementById("button-enterxr");
        this.noSupportedOverlay =   document.getElementById("notSupported");
        this.user =                 new THREE.Object3D(); 
        this.raycastObjects =       [];
        this.raycaster =            new THREE.Raycaster();
        this.buttondown =           false;
        this.isGrabbingCutout =     false;
        this.rayDefaultLength =     100;
        this.tempMatrix =           new THREE.Matrix4();
        this.ui3d =                 new THREE.Object3D();
        this.font_size =            0.05;
        this.running =              false;
        this.supported =            true;
        this.hasHover = false;
        this.uiSettings = {
            color_idle:         0xffffff,
            color_hover:        0xffffff, 
            opacity_idle:       0.66,
            opacity_hover:      1.00,
            opacity_inactive:   0.20,
            menuDepth:          -2.5,
            menuHeight:         1.5,
        };
        this.ui = [
            {
                uid:                    "ui-further",
                icon:                   {file:"./assets/gltf/icon/further_icon.gltf",mesh:undefined},   
                text:                   {text:"Further",mesh:undefined,bbox:undefined},             
                hover:                  false,
                position:               {offset:{x:-1.25,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "click", //if type toggle, state flips
            },
            {
                uid:                    "ui-closer",
                icon:                   {file:"./assets/gltf/icon/closer_icon.gltf",mesh:undefined},   
                text:                   {text:"Closer",mesh:undefined,bbox:undefined},             
                hover:                  false,
                position:               {offset:{x:-0.75,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "click", //if type toggle, state flips
            },
            {
                uid:                    "ui-audio",
                icon:                   {file:"./assets/gltf/icon/musical_notes.gltf",mesh:undefined},   
                text:                   {text:"Audio On",alttext:"Audio Off",mesh:undefined,altmesh:undefined,bbox:undefined}, 
                hover:                  false,
                position:               {offset:{x:-0.25,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "toggle", //if type toggle, state flips
            },
            {
                uid:                    "ui-playpause",
                icon:                   {file:"./assets/gltf/icon/playpause.gltf",mesh:undefined},   
                text:                   {text:"Pause",alttext:"Play",mesh:undefined,altmesh:undefined,bbox:undefined},             
                hover:                  false,
                position:               {offset:{x:0.25,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "toggle", //if type toggle, state flips
            },
            {
                uid:                    "ui-scaledown",
                icon:                   {file:"./assets/gltf/icon/smaller_icon.gltf",mesh:undefined},   
                text:                   {text:"Smaller",mesh:undefined,bbox:undefined},             
                hover:                  false,
                position:               {offset:{x:0.75,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "click", //if type toggle, state flips
            },
            {
                uid:                    "ui-scaleup",
                icon:                   {file:"./assets/gltf/icon/larger_icon.gltf",mesh:undefined},   
                text:                   {text:"Larger",mesh:undefined,bbox:undefined},             
                hover:                  false,
                position:               {offset:{x:1.25,y:0,z:0},scale:1,rotation:0.3},
                state:                  0,
                type:                   "click", //if type toggle, state flips
            }
        ];
        this.init();
    }
    //-------------------------------
    init(){
        var geo = new THREE.SphereGeometry( 0.030, 12, 12 );
        var mat = new THREE.MeshBasicMaterial({color:0xffffff});
        this.raydot = new THREE.Mesh( geo, mat );
        _C.THREE.scene.add(this.raydot);
        this.raydot.visible = false;
        _C.THREE.scene.add(this.ui3d);
        _C.THREE.scene.add(this.user); 
        this.initErrorOverlay();
        this.initInteractions();
        this.createUiBackdrop();
        this.load3dFont(()=>{
            this.createUiMenu();
        });
    }
    //-------------------------------
    initErrorOverlay(){
        window.onerror = (error,url,line)=>{ //show error in xr to help with debugging
            document.getElementById('errorOverlayXR').style.display =   'block';
            document.getElementById('errorOverlayXR').innerHTML =       "<div>ERROR - "+error+" | "+url+" | line:"+line+"</div>";
        };
    }
    //-------------------------------
    showEnterButton(){
        if(!this.supported)return;
        this.enterButton.style.display = 'block';
    }
    //-------------------------------
    hideEnterButton(){
        this.enterButton.style.display = 'none';
    }
    //-------------------------------
    initInteractions(){
        this.enterButton.addEventListener('click',()=>{
            this.enter();
        },true);
    }
    //-------------------------------
    setRaycaster(_controller){
        this.tempMatrix.identity().extractRotation( _controller.matrixWorld );
        this.raycaster.ray.origin.setFromMatrixPosition( _controller.matrixWorld );
        this.raycaster.ray.direction.set(0,0,-1).applyMatrix4( this.tempMatrix );
        //this.tempMatrix.getInverse( _controller.matrixWorld );
    }
    //-------------------------------
    controllerInteractPressDown(e){
        this.buttondown = true;
        var _controller = e.target; 
        this.setRaycaster(_controller); 
        var intersections = this.raycaster.intersectObjects( this.raycastObjects ); 
        if(intersections.length==0)return;
        for(const intersect of intersections){
            if( intersect.object.name.includes("bbox-") ){ 
                var bbox =      _C.THREE.scene.getObjectByName( "bbox-cutout" );    //bbox
                var object =    _C.THREE.scene.getObjectByName( "mesh-cutout" );    //model
                if(bbox && object){
                    bbox.userData.selected = true;
                    _controller.attach( object );
                    _controller.userData.grabbingModel = object;
                    this.isGrabbingCutout = true;
                    break;
                }
            }
            if( intersect.object.name.includes("ui-") ){ 
                if( intersect.object.name.includes("further") )_C.XR.user.position.z += 0.1;
                if( intersect.object.name.includes("closer") )_C.XR.user.position.z -= 0.1;
                if( intersect.object.name.includes("audio") )_C.CUTOUT.toggleAudio(intersect.object.userData.ui);
                if( intersect.object.name.includes("playpause") )_C.CUTOUT.togglePlayPause(intersect.object.userData.ui);
                if( intersect.object.name.includes("scaledown") )_C.CUTOUT.scaleCutout(1);
                if( intersect.object.name.includes("scaleup") )_C.CUTOUT.scaleCutout(-1);
                break;
            }
        }               
    }
    //-------------------------------
    controllerInteractPressUp(e){
        this.buttondown = false;
        var _controller = e.target;
        if(_controller.userData.grabbingModel !== undefined ){
            var object = _controller.userData.grabbingModel;
            _C.THREE.scene.attach( object ); 
            object.userData.selected = false;
            _controller.userData.grabbingModel = undefined;
        }
        this.isGrabbingCutout = false;
    }
    //-------------------------------
    isXrPassthroughSupported(){
        if(window.navigator.userAgent.includes("OculusBrowser")){
            this.supported = true;
            return true;
        }
        if('xr' in navigator){
            navigator.xr.isSessionSupported( 'immersive-ar' ).then((supported)=>{  // check xr support
                if(supported){
                    this.supported = true;
                    return true;
                }else{
                    this.supported = false;
                    return false;
                }
            });
        }else{
            this.supported = false;
            return false;
        }
    }
    //-------------------------------
    enter(){

        if(!this.isXrPassthroughSupported()){
            this.noSupportedOverlay.style.display = 'block';
            this.enterButton.style.display = 'none';
            return;
        }

        if(!this.controller1&&!this.controller2)this.setupControllers();

        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType( 'local' );
        navigator.xr.requestSession('immersive-ar',{ 
            optionalFeatures: [ 
                'local-floor'
                //'bounded-floor', 
                //'hand-tracking' 
            ] 
        }).then((s)=>{
            this.renderer.xr.setSession( s );
            this.passthroughSession = s;
            this.passthroughSession.addEventListener('end',()=>{
                this.exit();
            });
        });

        this.user.add(_C.THREE.camera); 
        this.user.position.set(0,0,0);
        _C.THREE.camera.position.set(0,0,0);
        _C.THREE.grid.visible = false;
        this.running = true;

    }
    //-------------------------------
    exit(){
        if(this.passthroughSession)this.passthroughSession.end();
        this.user.remove(_C.THREE.camera); 
        this.renderer.xr.enabled =      false;
        _C.THREE.grid.visible =         true;
        this.running =                  false;
    }
    //-------------------------------
    setupControllers(){

        this.controller1 = this.renderer.xr.getController( 0 );
        if(this.controller1){
            this.controller1.addEventListener( 'selectstart', this.controllerInteractPressDown.bind(this) );
            this.controller1.addEventListener( 'selectend', this.controllerInteractPressUp.bind(this) );
            this.controller1.addEventListener( 'connected', ( event )=> {
                this.user.add( this.controller1 );
            });
        }

        this.controller2 = this.renderer.xr.getController( 1 );
        if(this.controller2){
            this.controller2.addEventListener( 'selectstart', this.controllerInteractPressDown.bind(this) );
            this.controller2.addEventListener( 'selectend', this.controllerInteractPressUp.bind(this) );
            this.controller2.addEventListener( 'connected', ( event )=> {
                this.user.add( this.controller2 );
            });
        }

        var geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );
        var material = new THREE.LineBasicMaterial({color:0xffffff,linewidth:2});
        var line = new THREE.Line( geometry,material );
        line.name = 'line';
        line.scale.z = this.rayDefaultLength;
        var geometry = new THREE.CylinderGeometry( 0.01, 0.01, 1, 12 );
        var material = new THREE.MeshBasicMaterial({color:0xffffff});
        var line2 = new THREE.Mesh( geometry, material );
        if(this.controller1)this.controller1.add( line.clone() );
        if(this.controller2)this.controller2.add( line.clone() );

    }
    //-------------------------------
    update(){
        this.unHoverAll();
        this.hasHover = false;
        if(this.controller1)this.controllerHoverUpdate(this.controller1);
        if(this.controller2)this.controllerHoverUpdate(this.controller2);
        if(!this.hasHover)this.rayUnhover();
    }
    //-------------------------------
    unHoverAll(){
        _C.THREE.scene.traverse((child)=>{
            if(child.material&&child.name.includes("ui-")&&child.isMesh)child.material.opacity = this.uiSettings.opacity_idle;
        });
    }
    //-------------------------------
    setHoverForMesh(_meshName){
        var mesh = _C.THREE.scene.getObjectByName(_meshName);
        mesh.traverse((child)=>{
            if(child.material)child.material.opacity = this.uiSettings.opacity_hover;
        });
    }
    //-------------------------------
    controllerHoverUpdate(_controller){
        var line = _controller.getObjectByName( 'line' );
        this.setRaycaster(_controller);
        var intersections = this.raycaster.intersectObjects( this.raycastObjects ); 
        for(const intersect of intersections){
            if(intersect.object.name.includes("ui-")&&intersect.object.name.includes("-bbox")){ 
                var name = intersect.object.name.split("-")[1]; //ui-<NAME>-bbox
                this.setHoverForMesh("ui-"+name+"-icon");
                this.setHoverForMesh("ui-"+name+"-mesh");
                this.setHoverForMesh("ui-"+name+"-altmesh");
                this.rayHover(intersect,line);
                this.hasHover = true;
                break;
            }
            if(intersect.object.name.includes("bbox-cutout")){ 
                this.rayHover(intersect,line);
                this.hasHover = true;
                break;
            }
        }
    }
    //-------------------------------
    rayHover(intersect,line){
        this.raydot.visible = true;
        var pt = intersect.point;
        if(pt)this.raydot.position.set(pt.x,pt.y,pt.z);
        if(line)line.scale.z = intersect.distance*0.70;
    }
    //-------------------------------
    rayUnhover(){
        this.raydot.visible = false;
        if(this.controller1)this.controller1.getObjectByName( 'line' ).scale.z = this.rayDefaultLength;
        if(this.controller2)this.controller2.getObjectByName( 'line' ).scale.z = this.rayDefaultLength;
    }
    //-------------------------------
    async createUiMenu(){
        var loadIconPromises = [];
        for(const ui of this.ui)loadIconPromises.push(this.loadIcon(ui));
        const uis = await Promise.all(loadIconPromises);
        for(const ui of this.ui)this.setupUi3d(ui);
    }
    //-------------------------------
    loadIcon(ui){
        return new Promise((resolve) => {
            var gltf_loader = new GLTFLoader();
            gltf_loader.load(ui.icon.file,(_gltf)=>{
                ui.icon.mesh = _gltf.scene;
                resolve(true);
            });
        });
    }
    //-------------------------------
    load3dFont(_cb){
        this.font_loader = new FontLoader();
        this.font_loader.load('./assets/font/Poppins_Black_Regular.json',(_font)=>{
            this.font = _font;  
            _cb();
        });
    }
    //-------------------------------
    create3dText(_string){
        var geometry = new TextGeometry(_string,{
            font:               this.font,
            size:               this.font_size,
            height:             this.font_size*0.05, 
            curveSegments:      12,
            bevelEnabled:       false,
        });
        var material = new THREE.MeshBasicMaterial({ 
            color:          this.uiSettings.color_idle, 
            transparent:    true, 
            opacity:        this.uiSettings.opacity_idle 
        });
        var textMesh = new THREE.Mesh( geometry, material );
        geometry.computeBoundingBox();
        var textWidth = (geometry.boundingBox.max.x - geometry.boundingBox.min.x); //need to center x
        geometry.translate(-textWidth*0.5,0,0); //center horizontal
        return textMesh;
    }
    //-------------------------------
    createUiBackdrop(){
        var planeGeom = new THREE.PlaneGeometry(3.25,0.6);
        var planeMat = new THREE.MeshBasicMaterial({
            color:          0x000000,
            side:           THREE.DoubleSide,
            transparent:    true,
            opacity:        0.33,
            //depthWrite:   false
        });
        var menuDarkenPlane = new THREE.Mesh(planeGeom, planeMat);
        menuDarkenPlane.position.z = this.uiSettings.menuDepth-0.1;
        menuDarkenPlane.position.y = this.uiSettings.menuHeight;
        this.ui3d.add(menuDarkenPlane);
    }
    //-------------------------------
    setupUi3d(ui){

        //-------------
        //icon
        ui.icon.mesh.name = ui.uid+"-icon";
        ui.icon.mesh.position.set( 
            ui.position.offset.x,
            ui.position.offset.y+this.uiSettings.menuHeight,
            ui.position.offset.z+this.uiSettings.menuDepth
        ); 
        ui.icon.mesh.rotation.x = ui.position.rotation;
        var s = 0.0275;
        ui.icon.mesh.scale.set(s,s,s);
        var mat = new THREE.MeshBasicMaterial({ 
            color:          this.uiSettings.color_idle, 
            transparent:    true, 
            opacity:        this.uiSettings.opacity_idle 
        });
        ui.icon.mesh.traverse((child)=>{
            if(child.material)child.material = mat;
        });
        this.ui3d.add(ui.icon.mesh);

        //-------------
        //text mesh
        ui.text.mesh = this.create3dText(ui.text.text);
        ui.text.mesh.name = ui.uid+"-mesh";
        ui.text.mesh.userData.ui = ui; 
        ui.text.mesh.position.set( 
            ui.position.offset.x,
            ui.position.offset.y+this.uiSettings.menuHeight-0.2, 
            ui.position.offset.z+this.uiSettings.menuDepth
        );
        ui.text.mesh.material.color.setHex(this.uiSettings.color_idle);
        ui.text.mesh.rotation.x = ui.position.rotation;
        this.ui3d.add(ui.text.mesh);

        //-------------
        //alt text mesh
        if(ui.type=="toggle"){ 
            ui.text.altmesh = this.create3dText(ui.text.alttext);
            ui.text.altmesh.name = ui.uid+"-altmesh";
            ui.text.altmesh.userData.ui = ui; 
            ui.text.altmesh.position.set( 
                ui.position.offset.x,
                ui.position.offset.y+this.uiSettings.menuHeight-0.2, 
                ui.position.offset.z+this.uiSettings.menuDepth
            );
            ui.text.altmesh.material.color.setHex(this.uiSettings.color_idle);
            ui.text.altmesh.rotation.x = ui.position.rotation;
            this.ui3d.add(ui.text.altmesh);
            ui.text.altmesh.visible = false;
        }else{
            var dummyAlt = new THREE.Object3D();
            dummyAlt.name = ui.uid+"-altmesh";
            this.ui3d.add(dummyAlt);
            dummyAlt.visible = false;
        }

        //-------------
        //bbox
        var bboxsize = 0.50;
        var bbgeo = new THREE.BoxGeometry( bboxsize, bboxsize, 0.02 );
        var bbmat = new THREE.MeshBasicMaterial({color:0xeeeeee,transparent:true,opacity:0,visible:false});
        ui.text.bbox = new THREE.Mesh( bbgeo, bbmat );
        ui.text.bbox.position.set( 
            ui.position.offset.x,
            ui.position.offset.y+this.uiSettings.menuHeight-0.05,
            ui.position.offset.z+this.uiSettings.menuDepth-0.05
        ); 
        ui.text.bbox.rotation.x = 0.25;
        ui.text.bbox.name = ui.uid+"-bbox"; 
        this.raycastObjects.push( ui.text.bbox );
        ui.text.bbox.userData.ui = ui; 
        this.ui3d.add(ui.text.bbox);

    }
    
}

//#########################################################################################
class Bbox{
    //-------------------------------
    constructor(){
        this.mesh;      //passed mesh
        this.edges;     //bbox edges
        this.box;       //bbox box
        this.boxSize;
        this.boxCenter;
        this.settings = {
            color:              0x0000ff,
            boxOpacity:         0.5,
            boxOpacityHover:    0.75,
            edgeOpacity:        0.5,
            edgeOpacityHover:   0.75,
            padding:            -0.1 //percent, can be positive or negative
        };
        this.boxSize =          new THREE.Vector3();
        this.boxCenter =        new THREE.Vector3();
        this.updateEvery =      5; //we dont need to update bbox every frame
        this.frameCounter =     0;
        this.showBoxMat =       false;
        this.showEdgeMat =      false;
        this.thickness =        0.05;
        this.behind =           -0.06; //move bbox back so no alpha bugs
        this.scaleReduce =      0.66; //make bbox a bit smaller
    }
    //-------------------------------
    getSizeAndCenter(){
        var box3 = new THREE.Box3().setFromObject(this.mesh);
        box3.getSize(this.boxSize);
        box3.getCenter(this.boxCenter);
        // console.log("bBox Size:");console.log(this.boxSize);
        // console.log("bBox Center:");console.log(this.boxCenter);
    }
    //-------------------------------
    create(_mesh){

        this.mesh = _mesh;

        this.getSizeAndCenter();

        //box
        var boxGeo = new THREE.BoxGeometry(1,1,1);
        var boxMat = new THREE.MeshBasicMaterial({
            color:              this.settings.color,
            transparent:        true,
            opacity:            this.settings.boxOpacity,
            visible:            this.showBoxMat,
            depthWrite:         true,
        });
        this.box = new THREE.Mesh(boxGeo,boxMat);
        this.box.scale.set(this.boxSize.x*this.scaleReduce,this.boxSize.y*this.scaleReduce,this.thickness);
        this.box.position.set(this.boxCenter.x,this.boxCenter.y,this.boxCenter.z+this.behind);

        //edges
        var lineGeo = new THREE.EdgesGeometry(boxGeo);
        var lineMat = new THREE.LineBasicMaterial({
            color:              0x333333,
            transparent:        true,
            opacity:            this.settings.edgeOpacity,
            visible:            this.showEdgeMat
        });
        this.edges = new THREE.Line(lineGeo,lineMat);
        this.edges.scale.set(this.boxSize.x*this.scaleReduce,this.boxSize.y*this.scaleReduce,this.thickness);
        this.edges.position.set(this.boxCenter.x,this.boxCenter.y,this.boxCenter.z+this.behind);

    }
    //-------------------------------
    updateMesh(_mesh){
        this.mesh = _mesh;
    }
    //-------------------------------
    update(){
        if(!this.box||!this.edges)return;
        //if(_C.CUTOUT.isGrabbingCutout)return;
        this.frameCounter++;
        if(this.frameCounter%this.updateEvery!=0)return;
        this.getSizeAndCenter();
        //this.box.rotation.set(0,0,0);//when move with xr controller, applies rotation, so need to reset
        //this.edges.rotation.set(0,0,0);//when move with xr controller, applies rotation, so need to reset
        this.box.scale.set(this.boxSize.x*this.scaleReduce,this.boxSize.y*this.scaleReduce,this.thickness);
        this.edges.scale.set(this.boxSize.x*this.scaleReduce,this.boxSize.y*this.scaleReduce,this.thickness);
        this.box.position.set(this.boxCenter.x,this.boxCenter.y,this.boxCenter.z+this.behind);
        this.edges.position.set(this.boxCenter.x,this.boxCenter.y,this.boxCenter.z+this.behind);
    }
    //-------------------------------
    hover(){
        this.box.color.set(this.settings.boxOpacityHover);
        this.edges.color.set(this.settings.edgeOpacityHover);
    }
    //-------------------------------
    unhover(){
        this.box.color.set(this.settings.boxOpacity);
        this.edges.color.set(this.settings.edgeOpacity);
    }
    //-------------------------------
    showEdges(){
        if(this.edges)this.edges.visible=true;
    }
    //-------------------------------
    hideEdges(){
        if(this.edges)this.edges.visible=false;
    }
    //-------------------------------
    showBox(){
        if(this.box)this.box.visible=true;
    }
    //-------------------------------
    hideBox(){
        if(this.box)this.box.visible=false;
    }

}

//#########################################################################################
var _C = {
    CUTOUT: undefined,
    XR:     undefined,
    BBOX:   undefined,
    THREE:  undefined
};
document.addEventListener('DOMContentLoaded',()=>{

    _C.THREE =      new Three();
    _C.BBOX =       new Bbox();
    _C.XR =         new XR(_C.THREE.renderer);
    _C.CUTOUT =     new Cutout();
    
},false);



