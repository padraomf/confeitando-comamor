SELECT user_id, json_extract(data,'$.phone') as ex, REPLACE(REPLACE(REPLACE(REPLACE(json_extract(data,'$.phone'), ' ', ''), '-', ''), '(', ''), ')', '') as clean FROM profiles;
