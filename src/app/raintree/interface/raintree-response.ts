export interface RaintreeResponse{
  status_code: string;
  message: string;
  status: string;
  StatusFlag?:number;
  [index:string]: any;
}
