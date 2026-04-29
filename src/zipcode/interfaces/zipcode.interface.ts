export interface ZipcodeResponse {
  zipcode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

export interface ZipcodeProvider {
  name: string;
  getZipcode(zipcode: string): Promise<ZipcodeResponse>;
}

export interface FieldMap {
  zipcode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

export interface ProviderConfig {
  name: string;
  url: string;
  urlSuffix?: string;
  fieldMap: FieldMap;
  timeout?: number;
}
