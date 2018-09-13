import { Component, Injectable, Pipe, PipeTransform, Input, Attribute } from '@angular/core'
import { SocketService } from '../backend/socket.service'
import { KFlop, KmxStatus } from '../hal/kflop'
import { Connector, IOPin } from '../hal'




// @Pipe({
//   name: 'connectorFilter',
//   pure: false
// })
// @Injectable()
// export class ConnectorPipe implements PipeTransform {
//   transform(items: any[], args: any[]): any {
//     if (items instanceof Array) {

//       // filter items array, items which match and return true will be kept, false will be filtered out
//       if ('JP7' === args as any as string) {
//         return items.map((value,index)=>{return {IO:index,value:value} }).filter((item, index) => { return index >= 0 && index <= 15 || index === 44 || index === 45 });
//       }
//       if ('JP4' === args as any as string) {
//         return items.map((value,index)=>{return {IO:index,value:value} }).filter((item, index) => { return index >= 16 && index <= 25 });
//       }
//       return []//items.filter((item) => { return false });
//     }
//   }
// }


@Component({
  selector: 'connector',
  //pipes: [ConnectorPipe],
  template: `
            
            <div *ngIf="single" class="card mx-auto">
              <h6 class="card-header text-center">{{connector.name}}</h6>
              <div class="row  p-1">
                <div class="iopin" *ngFor="let pin of getConnectorPins(); let pinNumber = index" [title]="(pinNumber + 1) + ' - ' + pin.name + ' - ' + pin.description">
                  <div class="iopin-shape fa" [ngClass]="{'iopin-output fa-external-link': pin.output, 'iopin-input fa-sign-in': !pin.output}"></div>
                </div>
              </div>
            </div>
            <div *ngIf="!single" class="card">
              <h6 class="card-header text-center">{{connector.name}}</h6>
              <div class="row p-1">
                <div class="iopin" *ngFor="let pin of getConnectorPins(true); let pinNumber = index" [title]="((pinNumber + 1)*2) + ' - ' + pin.name + ' - ' + pin.description">
                  <div class="iopin-shape fa" [ngClass]="{'iopin-output fa-external-link': pin.output, 'iopin-input fa-sign-in': !pin.output}"></div>
                </div>
              </div>
              <div class="row p-1">
                <div class="iopin" *ngFor="let pin of getConnectorPins(false); let pinNumber = index" [title]="((pinNumber *2 )+1) + ' - ' + pin.name + ' - ' + pin.description">
                  <div class="iopin-shape fa" [ngClass]="{'iopin-output fa-external-link': pin.output, 'iopin-input fa-sign-in': !pin.output}"></div>
                </div>
              </div>
            </div>
            `,
  styles: [`
      .iopin {
        /*height: 4em;*/
        height: 40px;
        width: 40px;
        line-height: 40px;
        font-size: 18px;
        margin: 0.3em;
      }

      .iopin-shape {
        /*height:100%;*/
        width: 100%;
        border-radius:50%;
        border: solid 4px #000000;
        background-color:#aeaeae;
        /* this will add 2 times border width on size of iopin*/
        /*box-sizing: content-box; */
        /*display:block;*/
        text-align: center;
        
    }

      .iopin-output {
        border-color:#FF0000;
        color:#000000;
      }
      .iopin-input {
        border-color:#00FF00;
        color:#000000;
      }


          

          
     `]
})
export class ConnectorComponent {
  intStatus: KmxStatus
  @Input() single: boolean
  kflop = KFlop.getInstance()
  connector: Connector

  constructor(private socketService: SocketService, @Attribute('name') name: string) {
    this.intStatus = this.socketService.data
    this.connector = this.kflop.getConnector(name)
  }

  getConnectorPins(even?: boolean) {
    //The modulus operation might seem backwards. 
    //But it is not the index but the pin number wich is index + 1 we are counting as even or not
    this.kflop.update(this.connector, this.intStatus)
    if (even === true) {
      return this.connector.pins.filter((item, index) => index % 2 != 0 )
    } else if (even === false) {
      return this.connector.pins.filter((item, index) => index % 2 == 0 )
    } else {
      return this.connector.pins
    }
  }

}


@Component({
  selector: 'digital-io',
  template: `
  <div class="container">
    <div class="row justify-content-center">
      <connector class="col-6 m-1" name="JP7"></connector>
    </div>
    <div class="row justify-content-center">
      <connector class="col-4 m-1" name="JP4"></connector>
      <connector class="col-4 m-1" name="JP6"></connector>    
    </div>
    <div class="row justify-content-center">
        <connector class="col-4 m-1" name="JP5" [single]="true"></connector>
    </div>
  <div>
            `,

})
export class DigitalIOComponent {
  constructor() { }
}

