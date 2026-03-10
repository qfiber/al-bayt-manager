export interface Building {
  id: string;
  name: string;
}

export interface ApartmentData {
  apartment: {
    id: string;
    apartmentNumber: string;
    status: string;
    occupancyStart: string | null;
    subscriptionAmount: string;
    subscriptionStatus: string;
    cachedBalance: string;
    buildingId: string;
    apartmentType: string;
    parentApartmentId: string | null;
  };
  buildingName: string;
  buildingAddress: string;
}

export interface IssueRow {
  issue: {
    id: string;
    buildingId: string;
    reporterId: string;
    floor: number | null;
    category: string;
    description: string;
    status: string;
    resolvedAt: string | null;
    createdAt: string;
  };
  buildingName: string;
  reporterName: string;
}
