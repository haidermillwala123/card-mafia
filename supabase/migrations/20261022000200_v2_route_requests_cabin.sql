-- Freshness is tracked per route and cabin, so an economy search is not marked fresh by a business pull.
alter table route_requests add column if not exists cabin cabin_class not null default 'business';
alter table route_requests drop constraint if exists route_requests_pkey;
alter table route_requests add primary key (origin_iata, dest_iata, cabin);
