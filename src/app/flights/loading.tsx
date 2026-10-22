import FlightLoader from '@/components/FlightLoader';

export default function Loading() {
  return <div className="a-pg"><div className="a-body" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><FlightLoader size="lg" label="Loading flights" /></div></div>;
}
