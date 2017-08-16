import React from 'react';
import ReactDOM from 'react-dom';
import Main from '../views/main.jsx';

import NES from './emulator/NES';

var nes = new NES();


window.onload = function(){

  nes.init('/Users/fatonramadani/Desktop/Mario.nes');
  
  ReactDOM.render(<Main />, document.getElementById('app'));
}
