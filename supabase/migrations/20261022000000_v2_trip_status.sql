-- v2 Trips screen: track where a plan stands.
alter type trip_status add value if not exists 'exploring';
alter type trip_status add value if not exists 'transferring';
alter type trip_status add value if not exists 'booked';
